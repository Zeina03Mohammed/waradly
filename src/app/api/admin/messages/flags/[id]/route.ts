import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { suspendUserAccount, banUserAccount } from '@/lib/users/moderation';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const actionSchema = z.object({ action: z.enum(['dismiss', 'warning', 'strike', 'suspension', 'ban']) });

const STATUS_MAP = {
  dismiss: 'dismissed',
  warning: 'warning',
  strike: 'strike',
  suspension: 'suspension',
  ban: 'ban',
} as const;

/** Escalation ladder — SPEC.md Section 11: Warning -> Strike -> Suspension -> Ban, a manual
 * admin decision each time, never an automated threshold. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const flag = await prisma.messageFlag.findUnique({
    where: { id: params.id },
    include: { message: { include: { sender: true } } },
  });
  if (!flag) return Errors.notFound();

  const before = flag.status;
  const newStatus = STATUS_MAP[parsed.data.action];

  await prisma.messageFlag.update({
    where: { id: flag.id },
    data: { status: newStatus, reviewed_by: auth.user.id, reviewed_at: new Date() },
  });

  await audit({
    actorId: auth.user.id,
    action: `message_flag.${parsed.data.action}`,
    entityType: 'message_flag',
    entityId: flag.id,
    before: { status: before },
    after: { status: newStatus },
  });

  const sender = flag.message.sender;

  if (parsed.data.action === 'suspension') {
    await suspendUserAccount(sender.id, auth.user.id, 'Contact-info circumvention: message flag escalation.');
  } else if (parsed.data.action === 'ban') {
    await banUserAccount(sender.id, auth.user.id, 'Contact-info circumvention: message flag escalation.');
  }

  if (parsed.data.action !== 'dismiss') {
    await notify({
      userId: sender.id,
      eventType: 'message.flag_escalated',
      message: `Your account received a ${parsed.data.action} for a policy violation in a message.`,
      email: {
        to: sender.email,
        subject: 'Wardly policy notice',
        body: `Your account received a ${parsed.data.action} regarding a message that appeared to contain contact information, which is against Wardly's Anti-Circumvention Policy.`,
      },
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
