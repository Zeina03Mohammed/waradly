'use client';

import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { RfqForm, useRfqFormState } from '@/components/RfqForm';

export default function NewRfqPage() {
  const { user, loading } = useRequireRole('buyer');
  const form = useRfqFormState();

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="page-title mb-8">Create RFQ</h1>
      <RfqForm values={form.values} setValues={form.setValues} attachments={form.attachments} setAttachments={form.setAttachments} />
    </Shell>
  );
}
