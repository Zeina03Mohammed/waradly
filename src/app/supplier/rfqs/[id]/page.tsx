'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface RfqDetail {
  id: string;
  title: string;
  status: string;
  quantity: string | null;
  unit: string | null;
  delivery_region: string | null;
  delivery_deadline: string | null;
  offer_deadline_at: string | null;
  quality_requirements: string | null;
  sample_required: boolean;
  attachments: { id: string; type: string; contains_identity_risk: boolean }[];
}

interface MyOffer {
  id: string;
  rfq_id: string;
  status: string;
}

export default function SupplierRfqDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('supplier');
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [myOffer, setMyOffer] = useState<MyOffer | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ rfq: RfqDetail }>(`/api/rfqs/${params.id}`).then((d) => setRfq(d.rfq));
    api<{ offers: MyOffer[] }>('/api/offers').then((d) => setMyOffer(d.offers.find((o) => o.rfq_id === params.id) ?? null));
  }, [user, params.id]);

  if (loading || !user) return null;
  if (!rfq) return <Shell>Loading…</Shell>;

  const deadlinePassed = rfq.offer_deadline_at ? new Date(rfq.offer_deadline_at) < new Date() : false;

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{rfq.title}</h1>
        <span className="badge">{rfq.status}</span>
      </div>

      <div className="card mb-4 space-y-2 text-sm">
        <p>
          <span className="font-medium">Quantity:</span> {rfq.quantity} {rfq.unit}
        </p>
        <p>
          <span className="font-medium">Delivery region:</span> {rfq.delivery_region ?? '—'}
        </p>
        <p>
          <span className="font-medium">Delivery deadline:</span>{' '}
          {rfq.delivery_deadline ? new Date(rfq.delivery_deadline).toLocaleDateString() : '—'}
        </p>
        <p>
          <span className="font-medium">Offer deadline:</span>{' '}
          {rfq.offer_deadline_at ? new Date(rfq.offer_deadline_at).toLocaleString() : '—'}
        </p>
        <p>
          <span className="font-medium">Sample required:</span> {rfq.sample_required ? 'Yes' : 'No'}
        </p>
        <p>
          <span className="font-medium">Attachments:</span> {rfq.attachments.length} (watermarked previews only until awarded)
        </p>
      </div>

      {!deadlinePassed && !myOffer && (
        <Link href={`/supplier/rfqs/${rfq.id}/offer/new`} className="btn-primary">
          Submit Offer
        </Link>
      )}
      {myOffer && (
        <Link href="/supplier/offers" className="btn-secondary">
          View My Offer
        </Link>
      )}
      {deadlinePassed && !myOffer && <p className="text-gray-600">This RFQ is no longer accepting offers.</p>}
    </Shell>
  );
}
