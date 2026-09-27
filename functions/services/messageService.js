const { db } = require('../config/firebase');
const { scanMessage } = require('./messageDetectService');

async function sendMessage({ conversationId, senderId, content }) {
  const { flagged, maskedContent, matches } = scanMessage(content);

  const ref = db.collection('conversations').doc(conversationId).collection('messages').doc();
  await ref.set({
    sender_id: senderId,
    content,
    masked_content: maskedContent,
    flagged,
    created_at: new Date(),
  });

  for (const match of matches) {
    await ref.collection('flags').add({
      detected_pattern_type: match.type,
      matched_text: match.text,
      status: 'pending_review',
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date(),
    });
  }

  await db.collection('conversations').doc(conversationId).update({ updated_at: new Date() });

  return { id: ref.id, conversation_id: conversationId, sender_id: senderId, content, masked_content: maskedContent, flagged };
}

async function listMessages(conversationId) {
  const snap = await db.collection('conversations').doc(conversationId).collection('messages').orderBy('created_at', 'asc').get();
  return snap.docs.map((d) => ({ id: d.id, conversation_id: conversationId, ...d.data() }));
}

/** The counterpart never sees `content`, only `masked_content` — the sender and admin see the
 * real thing. This is the message-level analogue of the org/rfq masking-by-allowlist pattern. */
function serializeMessageFor(viewerId, message) {
  const seeReal = viewerId === message.sender_id || viewerId === 'admin';
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    content: seeReal ? message.content : message.masked_content,
    flagged: message.flagged,
    created_at: message.created_at,
  };
}

/** Admin's cross-conversation escalation queue — collection-group query on `flags`, same
 * pattern as the supplier-verification pending queue. */
async function listPendingMessageFlags() {
  const snap = await db.collectionGroup('flags').where('status', '==', 'pending_review').get();
  return snap.docs.map((d) => ({
    id: d.id,
    message_id: d.ref.parent.parent.id,
    conversation_id: d.ref.parent.parent.parent.parent.id,
    ...d.data(),
  }));
}

async function getFlagRef(conversationId, messageId, flagId) {
  return db.collection('conversations').doc(conversationId).collection('messages').doc(messageId).collection('flags').doc(flagId);
}

module.exports = { sendMessage, listMessages, serializeMessageFor, listPendingMessageFlags, getFlagRef };
