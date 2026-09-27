const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { createCategorySchema } = require('../validation/category');
const { zodFieldErrors } = require('../validation/auth');
const { createCategory, listCategories, getCategoryById, setCategoryStatus, isCategoryInUse, deleteCategory } = require('../services/categoryService');
const { audit } = require('../services/auditService');

const router = Router();

// Open list — no auth required, matches the original design (categories are public reference
// data, not sensitive).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ categories: await listCategories() });
  }),
);

const admin = Router();

admin.post(
  '/',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const category = await createCategory(parsed.data.name);
    if (!category) throw Errors.conflict('A category with this name already exists.');

    await audit({ actorId: req.user.id, action: 'category.created', entityType: 'category', entityId: category.id, after: category });
    res.status(201).json({ category });
  }),
);

admin.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const category = await getCategoryById(req.params.id);
    if (!category) throw Errors.notFound();
    if (await isCategoryInUse(req.params.id)) throw Errors.conflict('This category is in use and cannot be deleted.');

    await deleteCategory(req.params.id);
    await audit({ actorId: req.user.id, action: 'category.deleted', entityType: 'category', entityId: req.params.id, before: category });
    res.status(204).send();
  }),
);

admin.patch(
  '/:id/activate',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const category = await getCategoryById(req.params.id);
    if (!category) throw Errors.notFound();

    await setCategoryStatus(req.params.id, 'active');
    await audit({ actorId: req.user.id, action: 'category.activated', entityType: 'category', entityId: req.params.id });
    res.json({ category: { ...category, status: 'active' } });
  }),
);

admin.patch(
  '/:id/deactivate',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const category = await getCategoryById(req.params.id);
    if (!category) throw Errors.notFound();

    await setCategoryStatus(req.params.id, 'coming_soon');
    await audit({ actorId: req.user.id, action: 'category.deactivated', entityType: 'category', entityId: req.params.id });
    res.json({ category: { ...category, status: 'coming_soon' } });
  }),
);

module.exports = { publicRouter: router, adminRouter: admin };
