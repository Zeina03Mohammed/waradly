const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { createRfqSchema, updateRfqSchema, validateRfqForSubmit } = require('../validation/rfq');
const { zodFieldErrors } = require('../validation/auth');
const { canTransitionRfq, isRfqEditable } = require('../stateMachines/rfq');
const {
  createRfq,
  updateRfq,
  getRfqById,
  listRfqItems,
  listRfqAttachments,
  listRfqsForBuyer,
  setRfqStatus,
} = require('../services/rfqService');
const { getOrganizationByOwner, getOrganizationById } = require('../services/organizationService');
const { isSupplierEligibleForRfqFeed, listEligibleRfqsForSupplier } = require('../services/rfqEligibilityService');
const { serializeRfqFor } = require('../masking/rfq');
const { serializeOfferFor } = require('../masking/offer');
const { audit, listAuditLogsForEntity } = require('../services/auditService');
const { notify } = require('../services/notifyService');
const { createOfferSchema } = require('../validation/offer');
const { findActiveOfferForSupplier, createOffer, listOffersForRfq, listOpenOffersForRfq, setOfferStatus } = require('../services/offerService');

const router = Router();

async function loadBuyerOrg(req) {
  const org = await getOrganizationByOwner(req.user.id);
  if (!org || org.type !== 'buyer') throw Errors.forbidden();
  return org;
}

router.post(
  '/',
  authenticate,
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const parsed = createRfqSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const buyerOrg = await loadBuyerOrg(req);
    let rfq;
    try {
      rfq = await createRfq({ buyerOrg, buyerId: req.user.id, data: parsed.data });
    } catch (err) {
      if (err.code === 'file-ownership') throw Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
      throw err;
    }

    await audit({ actorId: req.user.id, action: 'rfq.created', entityType: 'rfq', entityId: rfq.id, after: { title: rfq.title } });
    res.status(201).json({ rfq: serializeRfqFor('owner', rfq) });
  }),
);

router.get(
  '/',
  authenticate,
  requireRole('buyer', 'supplier'),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'buyer') {
      const buyerOrg = await loadBuyerOrg(req);
      const rfqs = await listRfqsForBuyer(buyerOrg.id);
      return res.json({ rfqs: rfqs.map((r) => serializeRfqFor('owner', r)) });
    }

    const supplierOrg = await getOrganizationByOwner(req.user.id);
    if (!supplierOrg || supplierOrg.type !== 'supplier') throw Errors.forbidden();
    const rfqs = await listEligibleRfqsForSupplier(supplierOrg);
    res.json({ rfqs: rfqs.map((r) => serializeRfqFor('supplier', r)) });
  }),
);

async function loadRfqForViewer(req) {
  const rfq = await getRfqById(req.params.id);
  if (!rfq) throw Errors.notFound();

  if (req.user.role === 'admin') {
    if (rfq.status === 'SUBMITTED') await setRfqStatus(rfq.id, 'UNDER_REVIEW');
    return { rfq: rfq.status === 'SUBMITTED' ? { ...rfq, status: 'UNDER_REVIEW' } : rfq, relation: 'admin' };
  }

  if (req.user.role === 'buyer') {
    const buyerOrg = await getOrganizationByOwner(req.user.id);
    if (!buyerOrg || rfq.buyer_id !== buyerOrg.id) throw Errors.notFound();
    return { rfq, relation: 'owner' };
  }

  const supplierOrg = await getOrganizationByOwner(req.user.id);
  if (!supplierOrg || !(await isSupplierEligibleForRfqFeed(rfq, supplierOrg))) throw Errors.notFound();
  return { rfq, relation: 'supplier' };
}

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rfq, relation } = await loadRfqForViewer(req);
    const [items, attachments] = await Promise.all([listRfqItems(rfq.id), listRfqAttachments(rfq.id)]);
    res.json({ rfq: { ...serializeRfqFor(relation, rfq), items, attachments } });
  }),
);

router.patch(
  '/:id',
  authenticate,
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const parsed = updateRfqSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const buyerOrg = await loadBuyerOrg(req);
    const rfq = await getRfqById(req.params.id);
    if (!rfq || rfq.buyer_id !== buyerOrg.id) throw Errors.notFound();
    if (!isRfqEditable(rfq.status)) throw Errors.conflict('This RFQ can no longer be edited.');

    try {
      await updateRfq(rfq.id, parsed.data);
    } catch (err) {
      if (err.code === 'file-ownership') throw Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
      throw err;
    }

    await audit({ actorId: req.user.id, action: 'rfq.updated', entityType: 'rfq', entityId: rfq.id });
    const updated = await getRfqById(rfq.id);
    res.json({ rfq: serializeRfqFor('owner', updated) });
  }),
);

router.patch(
  '/:id/submit',
  authenticate,
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    if (!req.user.email_verified) throw Errors.emailNotVerified();

    const buyerOrg = await loadBuyerOrg(req);
    const rfq = await getRfqById(req.params.id);
    if (!rfq || rfq.buyer_id !== buyerOrg.id) throw Errors.notFound();
    if (!canTransitionRfq(rfq.status, 'SUBMITTED')) throw Errors.conflict('This RFQ cannot be submitted from its current status.');

    const fieldErrors = validateRfqForSubmit(rfq);
    if (Object.keys(fieldErrors).length > 0) throw Errors.validation(fieldErrors);

    await setRfqStatus(rfq.id, 'SUBMITTED');
    await audit({ actorId: req.user.id, action: 'rfq.submitted', entityType: 'rfq', entityId: rfq.id });

    res.json({ rfq: serializeRfqFor('owner', { ...rfq, status: 'SUBMITTED' }) });
  }),
);

router.patch(
  '/:id/cancel',
  authenticate,
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const buyerOrg = await loadBuyerOrg(req);
    const rfq = await getRfqById(req.params.id);
    if (!rfq || rfq.buyer_id !== buyerOrg.id) throw Errors.notFound();
    if (!canTransitionRfq(rfq.status, 'CANCELLED')) throw Errors.conflict('This RFQ cannot be cancelled from its current status.');

    await setRfqStatus(rfq.id, 'CANCELLED');
    await audit({ actorId: req.user.id, action: 'rfq.cancelled', entityType: 'rfq', entityId: rfq.id });

    const openOffers = await listOpenOffersForRfq(rfq.id);
    for (const offer of openOffers) {
      await setOfferStatus(offer.id, 'REJECTED');
      const supplierOrg = await getOrganizationById(offer.supplier_id);
      if (supplierOrg) {
        await notify({ userId: supplierOrg.owner_uid, eventType: 'offer.rejected', message: `The RFQ "${rfq.title}" was cancelled by the buyer.`, link: '/supplier/offers' });
      }
    }

    res.json({ rfq: serializeRfqFor('owner', { ...rfq, status: 'CANCELLED' }) });
  }),
);

router.get(
  '/:id/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const rfq = await getRfqById(req.params.id);
    if (!rfq) throw Errors.notFound();

    if (req.user.role !== 'admin') {
      const buyerOrg = await getOrganizationByOwner(req.user.id);
      if (!buyerOrg || rfq.buyer_id !== buyerOrg.id) throw Errors.forbidden();
    }

    res.json({ history: await listAuditLogsForEntity('rfq', rfq.id) });
  }),
);

/** Supplier submits an offer against a published RFQ. Auto-transitions the RFQ
 * PUBLISHED -> RECEIVING_OFFERS on the first offer (SPEC.md Section 8/9). */
router.post(
  '/:id/offers',
  authenticate,
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const parsed = createOfferSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const supplierOrg = await getOrganizationByOwner(req.user.id);
    if (!supplierOrg || supplierOrg.type !== 'supplier') throw Errors.forbidden();

    const rfq = await getRfqById(req.params.id);
    if (!rfq || !(await isSupplierEligibleForRfqFeed(rfq, supplierOrg))) throw Errors.notFound();

    if (rfq.offer_deadline_at && rfq.offer_deadline_at.toDate() < new Date()) {
      throw Errors.conflict('The offer deadline for this RFQ has passed.');
    }
    if (await findActiveOfferForSupplier(rfq.id, supplierOrg.id)) {
      throw Errors.conflict('You already have an active offer on this RFQ.');
    }

    let offer;
    try {
      offer = await createOffer({ rfq, supplierOrg, supplierId: req.user.id, data: parsed.data });
    } catch (err) {
      if (err.code === 'file-ownership') throw Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
      throw err;
    }

    if (rfq.status === 'PUBLISHED') {
      await setRfqStatus(rfq.id, 'RECEIVING_OFFERS');
    }
    await audit({ actorId: req.user.id, action: 'offer.submitted', entityType: 'offer', entityId: offer.id, after: { rfq_id: rfq.id } });

    const buyerOrg = await getOrganizationById(rfq.buyer_id);
    if (buyerOrg) await notify({ userId: buyerOrg.owner_uid, eventType: 'offer.submitted', message: `A new offer was submitted on "${rfq.title}".`, link: `/buyer/rfqs/${rfq.id}/offers` });

    res.status(201).json({ offer: serializeOfferFor('supplier', offer) });
  }),
);

/** Buyer's comparison view — every non-withdrawn offer on their own RFQ, supplier identity
 * already anonymized on the doc itself. */
router.get(
  '/:id/offers',
  authenticate,
  requireRole('buyer'),
  asyncHandler(async (req, res) => {
    const buyerOrg = await loadBuyerOrg(req);
    const rfq = await getRfqById(req.params.id);
    if (!rfq || rfq.buyer_id !== buyerOrg.id) throw Errors.notFound();

    const offers = await listOffersForRfq(rfq.id);
    res.json({ offers: offers.map((o) => serializeOfferFor('buyer', o)) });
  }),
);

module.exports = router;
