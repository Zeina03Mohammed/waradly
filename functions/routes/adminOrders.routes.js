const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { zodFieldErrors } = require('../validation/auth');
const { adminStatusTransitionSchema } = require('../validation/order');
const { canTransitionOrder, EVIDENCE_REQUIRED_STATUSES } = require('../stateMachines/order');
const { getOrderById, setOrderStatus, listOrderStatusHistory, applyOrderCompletionSideEffects } = require('../services/orderService');
const { setRfqStatus } = require('../services/rfqService');
const { getOrganizationById } = require('../services/organizationService');
const { serializeOrderFor } = require('../masking/order');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let query = db.collection('orders');
    if (req.query.status) query = query.where('status', '==', req.query.status);
    if (req.query.buyer_id) query = query.where('buyer_id', '==', req.query.buyer_id);
    if (req.query.supplier_id) query = query.where('supplier_id', '==', req.query.supplier_id);

    const snap = await query.get();
    res.json({ orders: snap.docs.map((d) => serializeOrderFor('admin', { id: d.id, ...d.data() })) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await getOrderById(req.params.id);
    if (!order) throw Errors.notFound();
    res.json({ order: serializeOrderFor('admin', order), status_history: await listOrderStatusHistory(order.id) });
  }),
);

const notesSchema = z.object({ notes: z.string().trim().max(2000) });

router.patch(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const parsed = notesSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const order = await getOrderById(req.params.id);
    if (!order) throw Errors.notFound();

    await db.collection('orders').doc(order.id).update({ admin_notes: parsed.data.notes, updated_at: new Date() });
    await audit({ actorId: req.user.id, action: 'order.notes_updated', entityType: 'order', entityId: order.id });
    res.json({ ok: true });
  }),
);

/** Manual "payment received" flip — no payment gateway exists in P0 (OD-P-01), so this is the
 * only way PENDING_PAYMENT ever advances. */
router.patch(
  '/:id/confirm-payment',
  asyncHandler(async (req, res) => {
    const order = await getOrderById(req.params.id);
    if (!order) throw Errors.notFound();
    if (order.status !== 'PENDING_PAYMENT') throw Errors.conflict('This order is not awaiting payment confirmation.');

    await setOrderStatus(order.id, 'PAYMENT_CONFIRMED', { changedBy: req.user.id });
    await audit({ actorId: req.user.id, action: 'order.payment_confirmed', entityType: 'order', entityId: order.id });

    const [buyerOrg, supplierOrg] = await Promise.all([getOrganizationById(order.buyer_id), getOrganizationById(order.supplier_id)]);
    // SPEC.md Section 14 — "Payment confirmed" is High priority.
    if (buyerOrg) {
      await notify({
        userId: buyerOrg.owner_uid,
        eventType: 'order.payment_confirmed',
        message: 'Your payment has been confirmed.',
        link: `/buyer/orders/${order.id}`,
        email: { subject: 'Your Waradly payment was confirmed', body: 'Your payment has been confirmed. The supplier can now begin production.' },
      });
    }
    if (supplierOrg) {
      await notify({
        userId: supplierOrg.owner_uid,
        eventType: 'order.payment_confirmed',
        message: 'Payment has been confirmed — you may begin production.',
        link: `/supplier/orders/${order.id}`,
        email: { subject: 'Waradly order payment confirmed', body: 'Payment has been confirmed for your order — you may begin production.' },
      });
    }

    res.json({ order: serializeOrderFor('admin', { ...order, status: 'PAYMENT_CONFIRMED' }) });
  }),
);

/** Generic, admin-forced status transition — can move an order to any state the state machine
 * allows (including ones no normal actor route reaches directly), always with a required reason
 * and, for hub/QC/delivery statuses, evidence. Blocked while DISPUTED — must go through the
 * dispute-resolve route instead (phase 8) rather than silently overriding a dispute in progress. */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const parsed = adminStatusTransitionSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const order = await getOrderById(req.params.id);
    if (!order) throw Errors.notFound();
    if (order.status === 'DISPUTED') throw Errors.conflict('This order is under dispute — resolve the dispute instead of forcing a status change.');
    if (!canTransitionOrder(order.status, parsed.data.status)) throw Errors.conflict('This transition is not allowed from the current status.');
    if (EVIDENCE_REQUIRED_STATUSES.includes(parsed.data.status) && !parsed.data.evidence_file_id) {
      throw Errors.validation({ evidence_file_id: 'Evidence is required for this status.' });
    }

    const before = { status: order.status };
    await setOrderStatus(order.id, parsed.data.status, {
      changedBy: req.user.id,
      evidenceFileId: parsed.data.evidence_file_id,
      note: parsed.data.reason,
    });
    await audit({
      actorId: req.user.id,
      action: 'order.status_forced',
      entityType: 'order',
      entityId: order.id,
      before,
      after: { status: parsed.data.status, reason: parsed.data.reason },
    });

    if (parsed.data.status === 'CANCELLED') {
      await setRfqStatus(order.rfq_id, 'CLOSED');
    }
    if (parsed.data.status === 'COMPLETED') {
      await applyOrderCompletionSideEffects({ ...order, status: 'COMPLETED' });
    }

    const [buyerOrg, supplierOrg] = await Promise.all([getOrganizationById(order.buyer_id), getOrganizationById(order.supplier_id)]);
    const message = `Order status updated to ${parsed.data.status}: ${parsed.data.reason}`;
    // SPEC.md Section 14 — "Delivered" is High priority; every other forced transition stays
    // in-app only.
    const emailPayload =
      parsed.data.status === 'DELIVERED' ? { subject: 'Your Waradly order has been delivered', body: message } : null;
    if (buyerOrg) await notify({ userId: buyerOrg.owner_uid, eventType: 'order.status_forced', message, link: `/buyer/orders/${order.id}`, email: emailPayload });
    if (supplierOrg) await notify({ userId: supplierOrg.owner_uid, eventType: 'order.status_forced', message, link: `/supplier/orders/${order.id}`, email: emailPayload });

    res.json({ order: serializeOrderFor('admin', { ...order, status: parsed.data.status }) });
  }),
);

module.exports = router;
