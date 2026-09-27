const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { zodFieldErrors } = require('../validation/auth');
const { canTransitionRfq } = require('../stateMachines/rfq');
const { getRfqById, setRfqStatus } = require('../services/rfqService');
const { getApprovedSupplierIdsForCategory } = require('../services/rfqEligibilityService');
const { getOrganizationById } = require('../services/organizationService');
const { serializeRfqFor } = require('../masking/rfq');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/review',
  asyncHandler(async (req, res) => {
    const snap = await db.collection('rfqs').where('status', 'in', ['SUBMITTED', 'UNDER_REVIEW']).orderBy('created_at', 'asc').get();
    const rfqs = snap.docs.map((d) => serializeRfqFor('admin', { id: d.id, ...d.data() }));
    res.json({ rfqs });
  }),
);

router.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const rfq = await getRfqById(req.params.id);
    if (!rfq) throw Errors.notFound();
    if (!canTransitionRfq(rfq.status, 'PUBLISHED')) throw Errors.conflict('This RFQ cannot be published from its current status.');

    await setRfqStatus(rfq.id, 'PUBLISHED', { published_at: new Date() });
    await audit({ actorId: req.user.id, action: 'rfq.approved', entityType: 'rfq', entityId: rfq.id });

    if (rfq.category_id) {
      const supplierOrgIds = await getApprovedSupplierIdsForCategory(rfq.category_id);
      for (const orgId of supplierOrgIds) {
        const org = await getOrganizationById(orgId);
        if (org) await notify({ userId: org.owner_uid, eventType: 'rfq.published', message: `A new RFQ matching your category is available: "${rfq.title}"`, link: `/supplier/rfqs/${rfq.id}` });
      }
    }
    const buyerOrg = await getOrganizationById(rfq.buyer_id);
    if (buyerOrg) await notify({ userId: buyerOrg.owner_uid, eventType: 'rfq.published', message: `Your RFQ "${rfq.title}" was approved and published.`, link: `/buyer/rfqs/${rfq.id}` });

    res.json({ rfq: serializeRfqFor('admin', { ...rfq, status: 'PUBLISHED' }) });
  }),
);

const rejectSchema = z.object({ reason: z.string().trim().min(1, 'A rejection reason is required.') });

router.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const rfq = await getRfqById(req.params.id);
    if (!rfq) throw Errors.notFound();
    if (!canTransitionRfq(rfq.status, 'REJECTED')) throw Errors.conflict('This RFQ cannot be rejected from its current status.');

    await setRfqStatus(rfq.id, 'REJECTED', { rejection_reason: parsed.data.reason });
    await audit({ actorId: req.user.id, action: 'rfq.rejected', entityType: 'rfq', entityId: rfq.id, after: { reason: parsed.data.reason } });

    const buyerOrg = await getOrganizationById(rfq.buyer_id);
    // SPEC.md Section 14 — "RFQ rejected" is High priority.
    if (buyerOrg) {
      await notify({
        userId: buyerOrg.owner_uid,
        eventType: 'rfq.rejected',
        message: `Your RFQ "${rfq.title}" was rejected: ${parsed.data.reason}`,
        link: `/buyer/rfqs/${rfq.id}`,
        email: { subject: 'Your Waradly RFQ was rejected', body: `Your RFQ "${rfq.title}" was rejected.\n\nReason: ${parsed.data.reason}` },
      });
    }

    res.json({ rfq: serializeRfqFor('admin', { ...rfq, status: 'REJECTED', rejection_reason: parsed.data.reason }) });
  }),
);

const notesSchema = z.object({ notes: z.string().trim().max(2000) });

router.patch(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const parsed = notesSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const rfq = await getRfqById(req.params.id);
    if (!rfq) throw Errors.notFound();

    await db.collection('rfqs').doc(rfq.id).update({ admin_notes: parsed.data.notes, updated_at: new Date() });
    await audit({ actorId: req.user.id, action: 'rfq.notes_updated', entityType: 'rfq', entityId: rfq.id });

    res.json({ ok: true });
  }),
);

router.get(
  '/:id/distribution',
  asyncHandler(async (req, res) => {
    const rfq = await getRfqById(req.params.id);
    if (!rfq) throw Errors.notFound();

    const snap = await db.collection('rfqs').doc(rfq.id).collection('distribution_overrides').get();
    res.json({ overrides: snap.docs.map((d) => ({ supplier_org_id: d.id, ...d.data() })) });
  }),
);

const distributionSchema = z.object({ supplier_org_id: z.string().min(1), included: z.boolean() });

router.patch(
  '/:id/distribution',
  asyncHandler(async (req, res) => {
    const parsed = distributionSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const rfq = await getRfqById(req.params.id);
    if (!rfq) throw Errors.notFound();

    await db
      .collection('rfqs')
      .doc(rfq.id)
      .collection('distribution_overrides')
      .doc(parsed.data.supplier_org_id)
      .set({ included: parsed.data.included, updated_at: new Date() });

    await audit({
      actorId: req.user.id,
      action: 'rfq.distribution_overridden',
      entityType: 'rfq',
      entityId: rfq.id,
      after: { supplier_org_id: parsed.data.supplier_org_id, included: parsed.data.included },
    });

    res.json({ ok: true });
  }),
);

module.exports = router;
