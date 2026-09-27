const { Router } = require('express');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { updateOfferSchema } = require('../validation/offer');
const { zodFieldErrors } = require('../validation/auth');
const { canTransitionOffer, isOfferEditable, OPEN_STATUSES } = require('../stateMachines/offer');
const { canTransitionRfq } = require('../stateMachines/rfq');
const {
  getOfferById,
  updateOffer,
  listOfferItems,
  listOfferAttachments,
  listOffersForSupplier,
  setOfferStatus,
} = require('../services/offerService');
const { getRfqById } = require('../services/rfqService');
const { getOrganizationByOwner, getOrganizationById } = require('../services/organizationService');
const { serializeOfferFor } = require('../masking/offer');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');

const router = Router();
router.use(authenticate);

async function loadOwnedOffer(req) {
  const supplierOrg = await getOrganizationByOwner(req.user.id);
  if (!supplierOrg) throw Errors.forbidden();
  const offer = await getOfferById(req.params.id);
  if (!offer || offer.supplier_id !== supplierOrg.id) throw Errors.notFound();
  return offer;
}

router.get(
  '/',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const supplierOrg = await getOrganizationByOwner(req.user.id);
    if (!supplierOrg) throw Errors.forbidden();
    const offers = await listOffersForSupplier(supplierOrg.id);
    res.json({ offers: offers.map((o) => serializeOfferFor('supplier', o)) });
  }),
);

router.get(
  '/:id',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const offer = await loadOwnedOffer(req);
    const [items, attachments] = await Promise.all([listOfferItems(offer.id), listOfferAttachments(offer.id)]);
    res.json({ offer: { ...serializeOfferFor('supplier', offer), items, attachments } });
  }),
);

router.patch(
  '/:id',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const parsed = updateOfferSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const offer = await loadOwnedOffer(req);
    if (!isOfferEditable(offer.status)) throw Errors.conflict('This offer can no longer be edited.');

    const rfq = await getRfqById(offer.rfq_id);
    if (rfq?.offer_deadline_at && rfq.offer_deadline_at.toDate() < new Date()) {
      throw Errors.conflict('The offer deadline for this RFQ has passed.');
    }

    await updateOffer(offer.id, parsed.data);
    await audit({ actorId: req.user.id, action: 'offer.updated', entityType: 'offer', entityId: offer.id });

    const updated = await getOfferById(offer.id);
    res.json({ offer: serializeOfferFor('supplier', updated) });
  }),
);

router.patch(
  '/:id/withdraw',
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const offer = await loadOwnedOffer(req);
    if (!canTransitionOffer(offer.status, 'WITHDRAWN')) throw Errors.conflict('This offer cannot be withdrawn from its current status.');

    await setOfferStatus(offer.id, 'WITHDRAWN', { withdrawn_at: new Date() });
    await audit({ actorId: req.user.id, action: 'offer.withdrawn', entityType: 'offer', entityId: offer.id });

    res.json({ offer: serializeOfferFor('supplier', { ...offer, status: 'WITHDRAWN' }) });
  }),
);

/** SPEC.md Section 9.4 — must happen atomically: accept this offer, reject every other open
 * offer on the RFQ, award the RFQ, create the Order, and fold in the order's first automatic
 * transition (OFFER_SELECTED -> PENDING_PAYMENT is "Auto, immediately after creation" per
 * Section 10.1 #2) into the same transaction, writing both status_history rows so the timeline
 * is complete. Audit logs are written inside the transaction too — an improvement over the
 * original, which wrote them just after commit, leaving a window where a committed state change
 * could exist without its audit trail. */
router.patch(
  '/:id/accept',
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const buyerOrg = await getOrganizationByOwner(req.user.id);
    if (!buyerOrg || buyerOrg.type !== 'buyer') throw Errors.forbidden();

    const offer = await getOfferById(req.params.id);
    if (!offer) throw Errors.notFound();
    const rfq = await getRfqById(offer.rfq_id);
    if (!rfq || rfq.buyer_id !== buyerOrg.id) throw Errors.notFound();

    if (!OPEN_STATUSES.includes(offer.status)) throw Errors.conflict('This offer is no longer available, please refresh.');
    if (!canTransitionRfq(rfq.status, 'AWARDED')) throw Errors.conflict('This RFQ cannot be awarded from its current status.');

    const offerRef = db.collection('offers').doc(offer.id);
    const rfqRef = db.collection('rfqs').doc(rfq.id);
    const orderRef = db.collection('orders').doc(rfq.id); // deterministic id = rfq id

    const competingSnap = await db
      .collection('offers')
      .where('rfq_id', '==', rfq.id)
      .where('status', 'in', OPEN_STATUSES)
      .get();
    const competingOffers = competingSnap.docs.filter((d) => d.id !== offer.id);

    await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (orderSnap.exists) throw Object.assign(new Error('already awarded'), { code: 'already-awarded' });

      tx.update(offerRef, { status: 'ACCEPTED', updated_at: new Date() });
      for (const doc of competingOffers) tx.update(doc.ref, { status: 'REJECTED', updated_at: new Date() });
      tx.update(rfqRef, { status: 'AWARDED', updated_at: new Date() });

      const orderData = {
        rfq_id: rfq.id,
        offer_id: offer.id,
        buyer_id: buyerOrg.id,
        supplier_id: offer.supplier_id,
        status: 'PENDING_PAYMENT',
        sample_required: Boolean(rfq.sample_required),
        admin_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      tx.set(orderRef, orderData);

      const historyRef1 = orderRef.collection('status_history').doc();
      tx.set(historyRef1, { from_status: null, to_status: 'OFFER_SELECTED', changed_by: req.user.id, evidence_file_id: null, note: null, changed_at: new Date() });
      const historyRef2 = orderRef.collection('status_history').doc();
      tx.set(historyRef2, { from_status: 'OFFER_SELECTED', to_status: 'PENDING_PAYMENT', changed_by: req.user.id, evidence_file_id: null, note: null, changed_at: new Date() });

      const auditRef1 = db.collection('audit_logs').doc();
      tx.set(auditRef1, { actor_id: req.user.id, action: 'offer.accepted', entity_type: 'offer', entity_id: offer.id, before_state: null, after_state: { order_id: orderRef.id }, created_at: new Date() });
      const auditRef2 = db.collection('audit_logs').doc();
      tx.set(auditRef2, { actor_id: req.user.id, action: 'order.created', entity_type: 'order', entity_id: orderRef.id, before_state: null, after_state: orderData, created_at: new Date() });
    });

    const winnerOrg = await getOrganizationById(offer.supplier_id);
    if (winnerOrg) {
      // SPEC.md Section 14 — both "Offer accepted" and "Order created" are High priority,
      // distinct events required by the notification table.
      await notify({
        userId: winnerOrg.owner_uid,
        eventType: 'offer.accepted',
        message: `Your offer on "${rfq.title}" was accepted!`,
        link: `/supplier/orders/${rfq.id}`,
        email: { subject: 'Your Waradly offer was accepted', body: `Your offer on "${rfq.title}" was accepted.` },
      });
      await notify({
        userId: winnerOrg.owner_uid,
        eventType: 'order.created',
        message: `An order has been created for "${rfq.title}".`,
        link: `/supplier/orders/${rfq.id}`,
        email: { subject: 'Your Waradly order has been created', body: `An order has been created for "${rfq.title}". Log in to view next steps.` },
      });
    }
    for (const doc of competingOffers) {
      const losingOrg = await getOrganizationById(doc.data().supplier_id);
      if (losingOrg) await notify({ userId: losingOrg.owner_uid, eventType: 'offer.rejected', message: `Your offer on "${rfq.title}" was not selected.`, link: '/supplier/offers' });
    }
    await notify({
      userId: req.user.id,
      eventType: 'order.created',
      message: `Your order for "${rfq.title}" has been created.`,
      link: `/buyer/orders/${rfq.id}`,
      email: { subject: 'Your Waradly order has been created', body: `Your order for "${rfq.title}" has been created. Please follow the payment instructions agreed with the Waradly team to proceed.` },
    });

    res.json({ order_id: rfq.id });
  }),
);

module.exports = router;
