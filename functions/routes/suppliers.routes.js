const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { categoryApplicationSchema, verificationDocumentSchema } = require('../validation/category');
const { zodFieldErrors } = require('../validation/auth');
const { getOrganizationByOwner, getOrganizationById } = require('../services/organizationService');
const { getCategoryById } = require('../services/categoryService');
const { getFileById } = require('../services/fileService');
const { applyForCategory, listCategoryApplications, createVerificationDocument } = require('../services/supplierService');
const { audit } = require('../services/auditService');

const router = Router();

function averageRating(supplierProfile) {
  const count = supplierProfile.rating_count || 0;
  return count > 0 ? supplierProfile.rating_sum / count : null;
}

router.get(
  '/me',
  authenticate,
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.notFound();

    res.json({
      supplier: {
        organization_id: org.id,
        anonymized_id: org.supplier_profile.anonymized_id,
        verification_status: org.supplier_profile.verification_status,
        completed_orders_count: org.supplier_profile.completed_orders_count,
        average_rating: averageRating(org.supplier_profile),
        approved_category_ids: org.approved_category_ids || [],
      },
    });
  }),
);

router.post(
  '/categories',
  authenticate,
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const parsed = categoryApplicationSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const category = await getCategoryById(parsed.data.category_id);
    if (!category) throw Errors.validation({ category_id: 'This category does not exist.' });

    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.notFound();

    const application = await applyForCategory(org.id, {
      categoryId: parsed.data.category_id,
      productionCapacity: parsed.data.production_capacity,
      materialsSupported: parsed.data.materials_supported,
    });
    if (!application) throw Errors.conflict('You have already applied for this category.');

    await audit({ actorId: req.user.id, action: 'supplier.category_applied', entityType: 'organization', entityId: org.id, after: { category_id: parsed.data.category_id } });
    res.status(201).json({ ok: true });
  }),
);

router.get(
  '/categories',
  authenticate,
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.notFound();
    res.json({ categories: await listCategoryApplications(org.id) });
  }),
);

/** Uploads reference an already-uploaded File (via POST /files) rather than accepting bytes
 * directly — keeps this route from re-implementing mime/size/signature validation that
 * POST /files already does. */
router.post(
  '/verification-documents',
  authenticate,
  requireRole('supplier'),
  asyncHandler(async (req, res) => {
    const parsed = verificationDocumentSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.notFound();

    const file = await getFileById(parsed.data.file_id);
    if (!file || file.deleted_at || file.uploader_id !== req.user.id) {
      throw Errors.validation({ file_id: 'File not found, or not uploaded by you.' });
    }

    const doc = await createVerificationDocument(org.id, { fileId: parsed.data.file_id, documentType: parsed.data.document_type });
    await audit({ actorId: req.user.id, action: 'supplier.verification_submitted', entityType: 'organization', entityId: org.id, after: { document_id: doc.id } });

    res.status(201).json({ document: doc });
  }),
);

/** Masked (self/counterpart/admin) supplier view by organization id — a thin wrapper around
 * GET /organizations/:id that additionally surfaces the self-only fields /organizations doesn't
 * (verification_status is only meaningful to the supplier themselves or an admin). */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const org = await getOrganizationById(req.params.id);
    if (!org || org.type !== 'supplier') throw Errors.notFound();

    const isSelf = org.owner_uid === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (isSelf || isAdmin) {
      return res.json({
        supplier: {
          organization_id: org.id,
          anonymized_id: org.supplier_profile.anonymized_id,
          verification_status: org.supplier_profile.verification_status,
          completed_orders_count: org.supplier_profile.completed_orders_count,
          average_rating: averageRating(org.supplier_profile),
        },
      });
    }

    res.json({
      supplier: {
        organization_id: org.id,
        anonymized_id: org.supplier_profile.anonymized_id,
        completed_orders_count: org.supplier_profile.completed_orders_count,
        average_rating: averageRating(org.supplier_profile),
      },
    });
  }),
);

module.exports = router;
