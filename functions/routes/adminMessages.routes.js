const { Router } = require('express');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { flagDecisionSchema } = require('../validation/message');
const { zodFieldErrors } = require('../validation/auth');
const { listPendingMessageFlags, getFlagRef } = require('../services/messageService');
const { suspendUserAccount, banUserAccount } = require('../services/moderationService');
const { notify } = require('../services/notifyService');
const { audit } = require('../services/auditService');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/flags',
  asyncHandler(async (req, res) => {
    res.json({ flags: await listPendingMessageFlags() });
  }),
);

/** Manual escalation ladder (SPEC.md Section 11): Warning -> Strike -> Suspension -> Ban, always
 * an admin decision, never automated thresholds. `strike`/`warning` are recorded on the flag
 * itself (no separate counter in P0); suspension/ban act on the sender's account via the shared
 * moderation service. */
router.patch(
  '/flags/:conversationId/:messageId/:flagId',
  asyncHandler(async (req, res) => {
    const parsed = flagDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const flagRef = await getFlagRef(req.params.conversationId, req.params.messageId, req.params.flagId);
    const flagSnap = await flagRef.get();
    if (!flagSnap.exists) throw Errors.notFound();

    const messageSnap = await db
      .collection('conversations')
      .doc(req.params.conversationId)
      .collection('messages')
      .doc(req.params.messageId)
      .get();
    if (!messageSnap.exists) throw Errors.notFound();
    const senderId = messageSnap.data().sender_id;

    const statusByAction = { dismiss: 'dismissed', warning: 'warning', strike: 'strike', suspension: 'suspension', ban: 'ban' };
    await flagRef.update({ status: statusByAction[parsed.data.action], reviewed_by: req.user.id, reviewed_at: new Date() });

    if (parsed.data.action === 'suspension') await suspendUserAccount(senderId, { reason: parsed.data.reason || 'Message flag escalation', actorId: req.user.id });
    if (parsed.data.action === 'ban') await banUserAccount(senderId, { reason: parsed.data.reason || 'Message flag escalation', actorId: req.user.id });

    await audit({ actorId: req.user.id, action: 'message_flag.decided', entityType: 'message', entityId: req.params.messageId, after: { action: parsed.data.action } });

    // SPEC.md Section 14 — message-flag escalations are High priority.
    if (['warning', 'strike', 'suspension', 'ban'].includes(parsed.data.action)) {
      await notify({
        userId: senderId,
        eventType: 'message_flag.action_taken',
        message: `A message you sent was flagged: ${parsed.data.action}.`,
        email: { subject: 'Waradly account notice', body: `A message you sent was flagged for containing contact information. Action taken: ${parsed.data.action}.` },
      });
    }

    res.json({ ok: true });
  }),
);

module.exports = router;
