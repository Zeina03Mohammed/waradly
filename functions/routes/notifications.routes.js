const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { listNotifications, markNotificationRead, markAllNotificationsRead } = require('../services/notifyService');

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ notifications: await listNotifications(req.user.id) });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const found = await markNotificationRead(req.user.id, req.params.id);
    if (!found) throw Errors.notFound();
    res.json({ ok: true });
  }),
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await markAllNotificationsRead(req.user.id);
    res.json({ ok: true });
  }),
);

module.exports = router;
