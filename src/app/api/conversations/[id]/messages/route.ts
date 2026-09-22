import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { detectContactInfo, maskContactInfo } from '@/lib/messages/detect';
import { serializeMessageFor } from '@/lib/messages/serialize';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const sendMessageSchema = z.object({ content: z.string().trim().min(1, 'Message cannot be empty.').max(2000) });

async function resolveParticipant(conversationId: string, userId: string, role: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { buyer: { include: { organization: true } }, supplier: { include: { organization: true } } },
  });
  if (!conversation) return { conversation: null, isParticipant: false };

  if (role === 'admin') return { conversation, isParticipant: true };

  if (role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(userId);
    return { conversation, isParticipant: !!buyerProfile && conversation.buyer_id === buyerProfile.id };
  }

  const supplierProfile = await getSupplierProfileForUser(userId);
  return { conversation, isParticipant: !!supplierProfile && conversation.supplier_id === supplierProfile.id };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const { conversation, isParticipant } = await resolveParticipant(params.id, auth.user.id, auth.user.role);
  if (!conversation) return Errors.notFound();
  if (!isParticipant) return Errors.notFound();

  const messages = await prisma.message.findMany({
    where: { conversation_id: conversation.id },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({
    messages: messages.map((m) => serializeMessageFor(m, auth.user.id, auth.user.role === 'admin')),
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const { conversation, isParticipant } = await resolveParticipant(params.id, auth.user.id, auth.user.role);
  if (!conversation) return Errors.notFound();
  if (!isParticipant || auth.user.role === 'admin') return Errors.forbidden();

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = sendMessageSchema.safeParse(json);
  if (!parsed.success) return Errors.validation({ content: parsed.error.issues[0]?.message ?? 'Invalid content.' });

  const matches = detectContactInfo(parsed.data.content);
  const flagged = matches.length > 0;
  const masked_content = flagged ? maskContactInfo(parsed.data.content, matches) : parsed.data.content;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversation_id: conversation.id,
        sender_id: auth.user.id,
        content: parsed.data.content,
        masked_content,
        flagged,
      },
    });

    if (flagged) {
      await tx.messageFlag.createMany({
        data: matches.map((m) => ({ message_id: created.id, detected_pattern_type: m.type, matched_text: m.text })),
      });
    }

    return created;
  });

  if (flagged) {
    await audit({
      actorId: auth.user.id,
      action: 'message.flagged',
      entityType: 'message',
      entityId: message.id,
      after: { pattern_types: matches.map((m) => m.type) },
    });
  }

  const recipientUserId =
    auth.user.id === conversation.buyer.organization.owner_user_id
      ? conversation.supplier.organization.owner_user_id
      : conversation.buyer.organization.owner_user_id;

  await notify({
    userId: recipientUserId,
    eventType: 'message.received',
    message: 'You have a new message.',
    link: `/messages/${conversation.id}`,
  });

  return NextResponse.json({ message: serializeMessageFor(message, auth.user.id, false) }, { status: 201 });
}
