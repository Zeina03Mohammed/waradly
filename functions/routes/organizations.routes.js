const { Router } = require('express');
const { z } = require('zod');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { getOrganizationByOwner, getOrganizationById, updateOrganization } = require('../services/organizationService');
const { serializeOrganizationFor, toSelfOrganizationView } = require('../masking/organization');
const { legalNameSchema } = require('../validation/auth');
const { audit } = require('../services/auditService');

const router = Router();

const patchOrgSchema = z.object({
  legal_name: legalNameSchema.optional(),
  display_name: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().min(1).optional(),
  general_region: z.string().trim().min(1).optional(),
  exact_address: z.string().trim().max(500).nullable().optional(),
  tax_id: z.string().trim().max(100).nullable().optional(),
});

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.notFound();
    res.json({ organization: toSelfOrganizationView(org) });
  }),
);

router.patch(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = patchOrgSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation({ _: 'Invalid organization data.' });

    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.notFound();

    await updateOrganization(org.id, parsed.data);
    await audit({ actorId: req.user.id, action: 'organization.updated', entityType: 'organization', entityId: org.id, before: { legal_name: org.legal_name, tax_id: org.tax_id, exact_address: org.exact_address }, after: parsed.data });
    const updated = await getOrganizationById(org.id);
    res.json({ organization: toSelfOrganizationView(updated) });
  }),
);

/** Full view for the owner or admin, masked (allowlist) view for anyone else. Real access
 * scoping to an actual counterpart (someone who shares an RFQ/offer/order/conversation with
 * this org) lands with those features in later phases — until then the masked view alone is the
 * safety net, since it contains nothing sensitive by construction. */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const org = await getOrganizationById(req.params.id);
    if (!org) throw Errors.notFound();

    const relation = req.user.role === 'admin' ? 'admin' : org.owner_uid === req.user.id ? 'self' : 'counterpart';
    res.json({ organization: serializeOrganizationFor(relation, org) });
  }),
);

module.exports = router;
