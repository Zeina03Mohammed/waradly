import type { Message } from '@prisma/client';

/** A message's `content` is only ever the true original for its own sender or Admin
 * ("the original content is retained for Admin review", SPEC.md Section 11); everyone else
 * gets masked_content once flagged, per the "flagged-but-delivered" rule. */
export function serializeMessageFor(message: Message, requesterId: string, requesterIsAdmin: boolean) {
  const isSender = message.sender_id === requesterId;
  const visibleContent = isSender || requesterIsAdmin ? message.content : message.flagged ? message.masked_content : message.content;

  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    content: visibleContent,
    flagged: message.flagged,
    created_at: message.created_at,
  };
}
