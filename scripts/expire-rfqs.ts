/**
 * Scheduled job — SPEC.md Section 8.1: "EXPIRED | System (auto at offer_deadline_at with no
 * offer accepted)". Run via cron or manually: `npm run expire-rfqs`.
 *
 * A plain Node script rather than a job-queue system, per the tech-stack decision — this is
 * the smallest reliable version that supports the real business rule.
 */
import { prisma } from '../src/lib/prisma';
import { audit } from '../src/lib/audit';
import { notify } from '../src/lib/notifications/notify';

async function main() {
  const now = new Date();

  const expiring = await prisma.rfq.findMany({
    where: {
      status: { in: ['PUBLISHED', 'RECEIVING_OFFERS'] },
      offer_deadline_at: { lt: now },
    },
    include: { buyer: { include: { organization: true } } },
  });

  for (const rfq of expiring) {
    await prisma.$transaction(async (tx) => {
      await tx.rfq.update({ where: { id: rfq.id }, data: { status: 'EXPIRED' } });
      // SPEC.md Section 9.2: offers on an expired RFQ also move to EXPIRED.
      await tx.offer.updateMany({
        where: { rfq_id: rfq.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        data: { status: 'EXPIRED' },
      });
    });

    await audit({
      actorId: null,
      action: 'rfq.expired',
      entityType: 'rfq',
      entityId: rfq.id,
      before: { status: rfq.status },
      after: { status: 'EXPIRED' },
    });

    await notify({
      userId: rfq.buyer.organization.owner_user_id,
      eventType: 'rfq.expired',
      message: `Your RFQ "${rfq.title}" expired with no offer accepted.`,
      link: `/buyer/rfqs/${rfq.id}`,
    });

    // eslint-disable-next-line no-console
    console.log(`Expired RFQ ${rfq.id} ("${rfq.title}")`);
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Expired ${expiring.length} RFQ(s).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
