const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { createDisputeSchema, resolveDisputeSchema } = require('../validation/dispute');
const { zodFieldErrors } = require('../validation/auth');
const { createDispute, getDisputeById, listDisputes, resolveDispute } = require('../services/disputeService');
const { getOrderById, listOrderStatusHistory, setOrderStatus } = require('../services/orderService');
const { getOrganizationByOwner, getOrganizationById } = require('../services/organizationService');
const { setRfqStatus } = require('../services/rfqService');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json({ disputes: await listDisputes(req.query.status) });
  }),
);

/** Mounted under /admin/disputes for parity with the original app's routing, but this one
 * endpoint is open to any order participant (buyer/supplier), not just admin — an order can
 * only ever be disputed by someone actually on it. */
router.post(
  '/',
  requireRole('buyer', 'supplier'),
  asyncHandler(async (req, res) => {
    const parsed = createDisputeSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));
    if (!req.body?.order_id) throw Errors.validation({ order_id: 'order_id is required.' });

    const org = await getOrganizationByOwner(req.user.id);
    const order = await getOrderById(req.body.order_id);
    if (!order || !org || (org.id !== order.buyer_id && org.id !== order.supplier_id)) throw Errors.notFound();
    if (order.status === 'DISPUTED') throw Errors.conflict('This order is already under dispute.');

    const dispute = await createDispute({ orderId: order.id, raisedBy: req.user.id, category: parsed.data.category, description: parsed.data.description });
    await setOrderStatus(order.id, 'DISPUTED', { changedBy: req.user.id, note: `Dispute opened: ${parsed.data.category}` });
    await audit({ actorId: req.user.id, action: 'dispute.opened', entityType: 'dispute', entityId: dispute.id, after: { order_id: order.id } });

    const [buyerOrg, supplierOrg] = await Promise.all([getOrganizationById(order.buyer_id), getOrganizationById(order.supplier_id)]);
    for (const counterpart of [buyerOrg, supplierOrg]) {
      // SPEC.md Section 14 — "Dispute open" is High priority.
      if (counterpart) {
        await notify({
          userId: counterpart.owner_uid,
          eventType: 'dispute.opened',
          message: `A dispute was opened on your order: ${parsed.data.category}`,
          link: `/orders/${order.id}`,
          email: { subject: 'A dispute was opened on your Waradly order', body: `A dispute was opened: ${parsed.data.category}\n\n${parsed.data.description}` },
        });
      }
    }

    res.status(201).json({ dispute });
  }),
);

router.get(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const dispute = await getDisputeById(req.params.id);
    if (!dispute) throw Errors.notFound();
    const order = await getOrderById(dispute.order_id);
    res.json({ dispute, order, status_history: order ? await listOrderStatusHistory(order.id) : [] });
  }),
);

router.patch(
  '/:id/resolve',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const parsed = resolveDisputeSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const dispute = await getDisputeById(req.params.id);
    if (!dispute) throw Errors.notFound();
    if (dispute.status === 'resolved') throw Errors.conflict('This dispute is already resolved.');

    const order = await getOrderById(dispute.order_id);
    if (!order) throw Errors.notFound();

    await resolveDispute(dispute.id, { outcome: parsed.data.outcome, notes: parsed.data.notes, resolvedBy: req.user.id });

    const nextOrderStatus = parsed.data.outcome === 'reopen_production' ? 'PRODUCTION' : 'CANCELLED';
    await setOrderStatus(order.id, nextOrderStatus, { changedBy: req.user.id, note: `Dispute resolved: ${parsed.data.outcome}` });
    if (nextOrderStatus === 'CANCELLED') await setRfqStatus(order.rfq_id, 'CLOSED');

    await audit({ actorId: req.user.id, action: 'dispute.resolved', entityType: 'dispute', entityId: dispute.id, after: { outcome: parsed.data.outcome } });

    const [buyerOrg, supplierOrg] = await Promise.all([getOrganizationById(order.buyer_id), getOrganizationById(order.supplier_id)]);
    for (const counterpart of [buyerOrg, supplierOrg]) {
      // SPEC.md Section 14 — "Dispute resolve" is High priority.
      if (counterpart) {
        await notify({
          userId: counterpart.owner_uid,
          eventType: 'dispute.resolved',
          message: `Your dispute was resolved: ${parsed.data.outcome}`,
          link: `/orders/${order.id}`,
          email: { subject: 'Your Waradly dispute was resolved', body: `Your dispute was resolved: ${parsed.data.outcome}${parsed.data.notes ? `\n\n${parsed.data.notes}` : ''}` },
        });
      }
    }

    res.json({ ok: true });
  }),
);

module.exports = router;
