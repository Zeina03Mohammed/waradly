const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { zodFieldErrors } = require('../validation/auth');
const { getUserById } = require('../services/userService');
const { getOrganizationByOwner } = require('../services/organizationService');
const { suspendUserAccount, banUserAccount, reactivateUserAccount } = require('../services/moderationService');
const { toAdminUserView } = require('../masking/user');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let query = db.collection('users');
    if (req.query.role) query = query.where('role', '==', req.query.role);
    if (req.query.status) query = query.where('status', '==', req.query.status);

    const snap = await query.get();
    let users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (req.query.search) {
      const needle = String(req.query.search).toLowerCase();
      users = users.filter((u) => u.email?.toLowerCase().includes(needle) || u.username?.toLowerCase().includes(needle));
    }

    const withOrgs = await Promise.all(
      users.map(async (u) => {
        const org = await getOrganizationByOwner(u.id);
        return { ...toAdminUserView(u), organization_name: org?.legal_name ?? null };
      }),
    );

    res.json({ users: withOrgs });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) throw Errors.notFound();
    const org = await getOrganizationByOwner(user.id);
    res.json({ user: toAdminUserView(user), organization: org ?? null });
  }),
);

const reasonSchema = z.object({ reason: z.string().trim().max(1000).optional() });

router.patch(
  '/:id/suspend',
  asyncHandler(async (req, res) => {
    const parsed = reasonSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const user = await getUserById(req.params.id);
    if (!user) throw Errors.notFound();

    await suspendUserAccount(user.id, { reason: parsed.data.reason, actorId: req.user.id });
    res.json({ ok: true });
  }),
);

router.patch(
  '/:id/ban',
  asyncHandler(async (req, res) => {
    const parsed = reasonSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const user = await getUserById(req.params.id);
    if (!user) throw Errors.notFound();

    await banUserAccount(user.id, { reason: parsed.data.reason, actorId: req.user.id });
    res.json({ ok: true });
  }),
);

router.patch(
  '/:id/reactivate',
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) throw Errors.notFound();

    await reactivateUserAccount(user.id, { actorId: req.user.id });
    res.json({ ok: true });
  }),
);

module.exports = router;
