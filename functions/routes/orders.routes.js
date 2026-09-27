const { Router } = require('express');
const { db, FieldValue } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { zodFieldErrors } = require('../validation/auth');
const { ratingSchema, sampleDecisionSchema } = require('../validation/order');
const { canTransitionOrder } = require('../stateMachines/order');
const {
  getOrderById,
  listOrderStatusHistory,
  setOrderStatus,
  listOrdersForBuyer,
  listOrdersForSupplier,
  applyOrderCompletionSideEffects,
} = require('../services/orderService');
const { getOrganizationByOwner, getOrganizationById } = require('../services/organizationService');
const { getRfqById, createRfq } = require('../services/rfqService');
const { serializeOrderFor } = require('../masking/order');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');

const router = Router();
router.use(authenticate);

async function loadViewableOrder(req) {
  const order = await getOrderById(req.params.id);
  if (!order) throw Errors.notFound();

  if (req.user.role === 'admin') return order;

  const org = await getOrganizationByOwner(req.user.id);
  if (!org) throw Errors.forbidden();
  if (org.id !== order.buyer_id && org.id !== order.supplier_id) throw Errors.notFound();
  return order;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let orders;
    if (req.user.role === 'admin') {
      const snap = await db.collection('orders').get();
      orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      const org = await getOrganizationByOwner(req.user.id);
      if (!org) throw Errors.forbidden();
      orders = org.type === 'buyer' ? await listOrdersForBuyer(org.id) : await listOrdersForSupplier(org.id);
    }
    const relation = req.user.role === 'admin' ? 'admin' : 'participant';
    res.json({ orders: orders.map((o) => serializeOrderFor(relation, o)) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await loadViewableOrder(req);
    const relation = req.user.role === 'admin' ? 'admin' : 'participant';
    res.json({ order: serializeOrderFor(relation, order), status_history: await listOrderStatusHistory(order.id) });
  }),
);

router.patch(
  '/:id/mark-production-started',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const supplierOrg = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.params.id);
    if (!order || !supplierOrg || order.supplier_id !== supplierOrg.id) throw Errors.notFound();
    if (!canTransitionOrder(order.status, 'PRODUCTION')) throw Errors.conflict('This order cannot start production from its current status.');

    await setOrderStatus(order.id, 'PRODUCTION', { changedBy: req.user.id });
    await audit({ actorId: req.user.id, action: 'order.production_started', entityType: 'order', entityId: order.id });

    const buyerOrg = await getOrganizationById(order.buyer_id);
    if (buyerOrg) await notify({ userId: buyerOrg.owner_uid, eventType: 'order.production_started', message: 'Production has started on your order.', link: `/buyer/orders/${order.id}` });

    res.json({ order: serializeOrderFor('participant', { ...order, status: 'PRODUCTION' }) });
  }),
);

router.patch(
  '/:id/mark-production-completed',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const supplierOrg = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.params.id);
    if (!order || !supplierOrg || order.supplier_id !== supplierOrg.id) throw Errors.notFound();
    if (order.sample_required && order.status !== 'PRODUCTION') {
      throw Errors.conflict('This order requires sample approval before production can be marked complete.');
    }
    if (!canTransitionOrder(order.status, 'PRODUCTION_COMPLETED')) throw Errors.conflict('This order cannot be marked complete from its current status.');

    await setOrderStatus(order.id, 'PRODUCTION_COMPLETED', { changedBy: req.user.id });
    await audit({ actorId: req.user.id, action: 'order.production_completed', entityType: 'order', entityId: order.id });

    const buyerOrg = await getOrganizationById(order.buyer_id);
    if (buyerOrg) await notify({ userId: buyerOrg.owner_uid, eventType: 'order.production_completed', message: 'Production is complete on your order.', link: `/buyer/orders/${order.id}` });

    res.json({ order: serializeOrderFor('participant', { ...order, status: 'PRODUCTION_COMPLETED' }) });
  }),
);

/** Supplier submits sample evidence — SAMPLE_REVIEW only applies when the order's RFQ had
 * sample_required set; the buyer then approves (back to PRODUCTION) or rejects (DISPUTED, once
 * disputes exist in phase 8). */
router.post(
  '/:id/samples',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const supplierOrg = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.params.id);
    if (!order || !supplierOrg || order.supplier_id !== supplierOrg.id) throw Errors.notFound();
    if (!order.sample_required || order.status !== 'PRODUCTION') throw Errors.conflict('This order is not awaiting a sample submission.');

    const evidenceFileId = req.body?.evidence_file_id || null;
    await setOrderStatus(order.id, 'SAMPLE_REVIEW', { changedBy: req.user.id, evidenceFileId });
    await audit({ actorId: req.user.id, action: 'order.sample_submitted', entityType: 'order', entityId: order.id });

    const buyerOrg = await getOrganizationById(order.buyer_id);
    // SPEC.md Section 14 — "sample events" are High priority.
    if (buyerOrg) {
      await notify({
        userId: buyerOrg.owner_uid,
        eventType: 'order.sample_submitted',
        message: 'A sample is ready for your review.',
        link: `/buyer/orders/${order.id}`,
        email: { subject: 'A Waradly sample is ready for review', body: 'A sample has been submitted for your order and is ready for your review.' },
      });
    }

    res.json({ order: serializeOrderFor('participant', { ...order, status: 'SAMPLE_REVIEW' }) });
  }),
);

router.patch(
  '/:id/samples/decision',
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const parsed = sampleDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const buyerOrg = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.params.id);
    if (!order || !buyerOrg || order.buyer_id !== buyerOrg.id) throw Errors.notFound();
    if (order.status !== 'SAMPLE_REVIEW') throw Errors.conflict('This order is not awaiting a sample decision.');

    const nextStatus = parsed.data.approved ? 'PRODUCTION' : 'DISPUTED';
    await setOrderStatus(order.id, nextStatus, { changedBy: req.user.id, note: parsed.data.note });
    await audit({ actorId: req.user.id, action: 'order.sample_decided', entityType: 'order', entityId: order.id, after: { approved: parsed.data.approved } });

    const supplierOrg = await getOrganizationById(order.supplier_id);
    if (supplierOrg) {
      await notify({
        userId: supplierOrg.owner_uid,
        eventType: 'order.sample_decided',
        message: parsed.data.approved ? 'Your sample was approved — resume production.' : 'Your sample was rejected.',
        link: `/supplier/orders/${order.id}`,
        email: {
          subject: parsed.data.approved ? 'Your Waradly sample was approved' : 'Your Waradly sample was rejected',
          body: parsed.data.approved ? 'Your sample was approved — you may resume production.' : `Your sample was rejected.${parsed.data.note ? ` Note: ${parsed.data.note}` : ''}`,
        },
      });
    }
    // Full dispute-record creation (categorized, admin-resolvable) lands in phase 8 — this only
    // sets the order's own status for now, matching how phase 5/6 deferred cross-phase pieces.

    res.json({ order: serializeOrderFor('participant', { ...order, status: nextStatus }) });
  }),
);

router.post(
  '/:id/rate',
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const parsed = ratingSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const buyerOrg = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.params.id);
    if (!order || !buyerOrg || order.buyer_id !== buyerOrg.id) throw Errors.notFound();
    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) throw Errors.conflict('This order cannot be rated yet.');

    const ratingRef = db.collection('ratings').doc(order.id);
    const existing = await ratingRef.get();
    if (existing.exists) throw Errors.conflict('This order has already been rated.');

    await ratingRef.set({
      order_id: order.id,
      buyer_id: buyerOrg.id,
      supplier_id: order.supplier_id,
      score: parsed.data.score,
      comment: parsed.data.comment ?? null,
      created_at: new Date(),
    });
    await db
      .collection('organizations')
      .doc(order.supplier_id)
      .update({ 'supplier_profile.rating_sum': FieldValue.increment(parsed.data.score), 'supplier_profile.rating_count': FieldValue.increment(1) });

    if (order.status === 'DELIVERED') {
      await setOrderStatus(order.id, 'COMPLETED', { changedBy: req.user.id });
      await applyOrderCompletionSideEffects({ ...order, status: 'COMPLETED' });
    }

    await audit({ actorId: req.user.id, action: 'order.rated', entityType: 'order', entityId: order.id, after: { score: parsed.data.score } });
    res.status(201).json({ ok: true });
  }),
);

router.post(
  '/:id/reorder',
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const buyerOrg = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.params.id);
    if (!order || !buyerOrg || order.buyer_id !== buyerOrg.id) throw Errors.notFound();
    if (order.status !== 'COMPLETED') throw Errors.conflict('Only completed orders can be reordered.');

    const sourceRfq = await getRfqById(order.rfq_id);
    if (!sourceRfq) throw Errors.notFound();

    const newRfq = await createRfq({
      buyerOrg,
      buyerId: req.user.id,
      data: {
        title: sourceRfq.title,
        category: sourceRfq.category_name,
        quantity: sourceRfq.quantity,
        unit: sourceRfq.unit,
        dimensions: sourceRfq.dimensions,
        material: sourceRfq.material,
        delivery_region: sourceRfq.delivery_region,
        source_rfq_id: sourceRfq.id,
      },
    });

    await audit({ actorId: req.user.id, action: 'rfq.reordered', entityType: 'rfq', entityId: newRfq.id, after: { source_order_id: order.id } });
    res.status(201).json({ rfq_id: newRfq.id });
  }),
);

module.exports = router;
