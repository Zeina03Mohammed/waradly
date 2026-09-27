const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { supplierVerificationDecisionSchema } = require('../validation/category');
const { zodFieldErrors } = require('../validation/auth');
const { getOrganizationById } = require('../services/organizationService');
const {
  listCategoryApplications,
  setCategoryApproval,
  listPendingVerifications,
  decideSupplierVerification,
} = require('../services/supplierService');
const { notify } = require('../services/notifyService');
const { audit } = require('../services/auditService');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/verification',
  asyncHandler(async (req, res) => {
    const pending = await listPendingVerifications();
    res.json({ documents: pending });
  }),
);

router.patch(
  '/:id/verification',
  asyncHandler(async (req, res) => {
    const parsed = supplierVerificationDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const org = await getOrganizationById(req.params.id);
    if (!org || org.type !== 'supplier') throw Errors.notFound();

    try {
      await decideSupplierVerification(org.id, {
        status: parsed.data.status,
        rejectionReason: parsed.data.rejection_reason,
        reviewerId: req.user.id,
      });
    } catch (err) {
      if (err.code === 'not-found') throw Errors.notFound();
      throw err;
    }

    await audit({
      actorId: req.user.id,
      action: 'supplier.verification_decided',
      entityType: 'organization',
      entityId: org.id,
      after: { status: parsed.data.status },
    });

    // SPEC.md Section 14 — "Supplier approved/rejected" is a High-priority, email-worthy event.
    const verified = parsed.data.status === 'verified';
    await notify({
      userId: org.owner_uid,
      eventType: 'supplier.verification_decided',
      message: verified ? 'Your supplier account has been verified.' : 'Your supplier verification was rejected.',
      link: '/supplier/verification',
      email: {
        subject: verified ? 'Your Waradly supplier account is verified' : 'Your Waradly supplier verification was rejected',
        body: verified
          ? 'Your supplier account has been verified. You can now apply for categories and receive RFQs.'
          : `Your supplier verification was rejected.${parsed.data.rejection_reason ? ` Reason: ${parsed.data.rejection_reason}` : ''}`,
      },
    });

    res.json({ ok: true });
  }),
);

router.get(
  '/:id/categories',
  asyncHandler(async (req, res) => {
    const org = await getOrganizationById(req.params.id);
    if (!org || org.type !== 'supplier') throw Errors.notFound();
    res.json({ categories: await listCategoryApplications(org.id) });
  }),
);

router.patch(
  '/:id/categories/:categoryId',
  asyncHandler(async (req, res) => {
    const org = await getOrganizationById(req.params.id);
    if (!org || org.type !== 'supplier') throw Errors.notFound();

    const approved = Boolean(req.body?.approved);
    try {
      await setCategoryApproval(org.id, req.params.categoryId, approved);
    } catch (err) {
      if (err.code === 'not-found') throw Errors.notFound();
      throw err;
    }

    await audit({
      actorId: req.user.id,
      action: approved ? 'supplier.category_approved' : 'supplier.category_revoked',
      entityType: 'organization',
      entityId: org.id,
      after: { category_id: req.params.categoryId },
    });

    res.json({ ok: true });
  }),
);

module.exports = router;
