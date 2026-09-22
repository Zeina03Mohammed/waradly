import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const patternType = searchParams.get('pattern_type');

  const flags = await prisma.messageFlag.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(patternType ? { detected_pattern_type: patternType as never } : {}),
    },
    include: { message: { include: { sender: true, conversation: true } } },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({
    flags: flags.map((f) => ({
      id: f.id,
      message_excerpt: f.message.content.slice(0, 200),
      sender_email: f.message.sender.email,
      conversation_id: f.message.conversation_id,
      detected_pattern_type: f.detected_pattern_type,
      status: f.status,
      created_at: f.created_at,
    })),
  });
}
