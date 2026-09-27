const { Router } = require('express');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { createConversationSchema, sendMessageSchema } = require('../validation/message');
const { zodFieldErrors } = require('../validation/auth');
const {
  findOrCreateRfqConversation,
  findOrCreateOrderConversation,
  getConversationById,
  listConversationsForOrg,
} = require('../services/conversationService');
const { sendMessage, listMessages, serializeMessageFor } = require('../services/messageService');
const { getRfqById } = require('../services/rfqService');
const { getOrderById } = require('../services/orderService');
const { getOrganizationByOwner, getOrganizationById } = require('../services/organizationService');
const { isSupplierEligibleForRfqFeed } = require('../services/rfqEligibilityService');
const { notify } = require('../services/notifyService');

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const snap = await db.collection('conversations').get();
      return res.json({ conversations: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    }
    const org = await getOrganizationByOwner(req.user.id);
    if (!org) throw Errors.forbidden();
    res.json({ conversations: await listConversationsForOrg(org.id, org.type) });
  }),
);

router.post(
  '/',
  requireRole('buyer', 'supplier'),
  asyncHandler(async (req, res) => {
    const parsed = createConversationSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    if (parsed.data.rfq_id) {
      if (req.user.role !== 'supplier') throw Errors.forbidden();
      const supplierOrg = await getOrganizationByOwner(req.user.id);
      const rfq = await getRfqById(parsed.data.rfq_id);
      if (!rfq || !supplierOrg || !(await isSupplierEligibleForRfqFeed(rfq, supplierOrg))) throw Errors.notFound();

      const conversation = await findOrCreateRfqConversation({ rfq, buyerOrgId: rfq.buyer_id, supplierOrgId: supplierOrg.id });
      return res.status(201).json({ conversation });
    }

    const order = await getOrderById(parsed.data.order_id);
    if (!order) throw Errors.notFound();
    const org = await getOrganizationByOwner(req.user.id);
    if (!org || (org.id !== order.buyer_id && org.id !== order.supplier_id)) throw Errors.notFound();

    const conversation = await findOrCreateOrderConversation({ order });
    res.status(201).json({ conversation });
  }),
);

async function loadParticipantConversation(req) {
  const conversation = await getConversationById(req.params.id);
  if (!conversation) throw Errors.notFound();
  if (req.user.role === 'admin') return conversation;

  const org = await getOrganizationByOwner(req.user.id);
  if (!org || (org.id !== conversation.buyer_id && org.id !== conversation.supplier_id)) throw Errors.notFound();
  return conversation;
}

router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const conversation = await loadParticipantConversation(req);
    const messages = await listMessages(conversation.id);
    const viewerId = req.user.role === 'admin' ? 'admin' : req.user.id;
    res.json({ messages: messages.map((m) => serializeMessageFor(viewerId, m)) });
  }),
);

/** Admin cannot send messages — read-only oversight, matching the original design. */
router.post(
  '/:id/messages',
  requireRole('buyer', 'supplier'),
  asyncHandler(async (req, res) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const conversation = await loadParticipantConversation(req);
    const senderOrg = await getOrganizationByOwner(req.user.id);
    const message = await sendMessage({ conversationId: conversation.id, senderId: req.user.id, content: parsed.data.content });

    const otherOrgId = conversation.buyer_id === senderOrg.id ? conversation.supplier_id : conversation.buyer_id;
    const otherOrg = await getOrganizationById(otherOrgId);
    if (otherOrg) await notify({ userId: otherOrg.owner_uid, eventType: 'message.received', message: 'You have a new message.', link: `/messages/${conversation.id}` });

    res.status(201).json({ message: serializeMessageFor(req.user.id, message) });
  }),
);

module.exports = router;
