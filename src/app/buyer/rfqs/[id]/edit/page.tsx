'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';
import { RfqForm, useRfqFormState, type Attachment } from '@/components/RfqForm';

interface RfqDetail {
  id: string;
  status: string;
  category_id: string | null;
  category_name: string | null;
  title: string;
  quantity: string | null;
  unit: string | null;
  dimensions: string | null;
  material: string | null;
  printing_customization: string | null;
  delivery_deadline: string | null;
  delivery_region: string | null;
  quality_requirements: string | null;
  sample_required: boolean;
  certifications_required: string | null;
  legal_compliance_requirements: string | null;
  offer_deadline_at: string | null;
  attachments: { id: string; file_id: string; type: Attachment['type']; contains_identity_risk: boolean }[];
}

function toLocalDate(iso: string | null) {
  return iso ? iso.slice(0, 10) : '';
}
function toLocalDateTime(iso: string | null) {
  return iso ? iso.slice(0, 16) : '';
}

export default function EditRfqPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('buyer');
  const router = useRouter();
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const form = useRfqFormState();

  useEffect(() => {
    if (!user) return;
    api<{ rfq: RfqDetail }>(`/api/rfqs/${params.id}`)
      .then((d) => {
        setRfq(d.rfq);
        form.setValues({
          category_name: d.rfq.category_name ?? '',
          title: d.rfq.title,
          quantity: d.rfq.quantity ?? '',
          unit: d.rfq.unit ?? '',
          dimensions: d.rfq.dimensions ?? '',
          material: d.rfq.material ?? '',
          printing_customization: d.rfq.printing_customization ?? '',
          delivery_deadline: toLocalDate(d.rfq.delivery_deadline),
          delivery_region: d.rfq.delivery_region ?? '',
          quality_requirements: d.rfq.quality_requirements ?? '',
          sample_required: d.rfq.sample_required,
          certifications_required: d.rfq.certifications_required ?? '',
          legal_compliance_requirements: d.rfq.legal_compliance_requirements ?? '',
          offer_deadline_at: toLocalDateTime(d.rfq.offer_deadline_at),
        });
        form.setAttachments(
          d.rfq.attachments.map((a) => ({ file_id: a.file_id, filename: a.file_id, type: a.type, contains_identity_risk: a.contains_identity_risk })),
        );
      })
      .catch(() => setForbidden(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id]);

  if (loading || !user) return null;
  if (forbidden) {
    return (
      <Shell>
        <p className="text-red-600">This RFQ can no longer be edited — cancel it and create a new one instead.</p>
      </Shell>
    );
  }
  if (!rfq) return <Shell>Loading…</Shell>;

  return (
    <Shell>
      <h1 className="page-title mb-8">Edit RFQ</h1>
      <RfqForm
        values={form.values}
        setValues={form.setValues}
        attachments={form.attachments}
        setAttachments={form.setAttachments}
        rfqId={rfq.id}
        onSaved={(id) => router.push(`/buyer/rfqs/${id}`)}
      />
    </Shell>
  );
}
