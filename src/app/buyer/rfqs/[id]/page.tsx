'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface RfqDetail {
  id: string;
  title: string;
  status: string;
  quantity: string;
  unit: string;
  delivery_deadline: string | null;
  delivery_region: string | null;
  offer_deadline_at: string | null;
  rejection_reason: string | null;
  attachments: { id: string; type: string }[];
}

export default function BuyerRfqDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('buyer');
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [offerCount, setOfferCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ rfq: RfqDetail }>(`/api/rfqs/${params.id}`).then((d) => setRfq(d.rfq));
    api<{ offers: unknown[] }>(`/api/rfqs/${params.id}/offers`)
      .then((d) => setOfferCount(d.offers.length))
      .catch(() => setOfferCount(0));
  }, [user, params.id]);

  if (loading || !user) return null;
  if (!rfq) return <Shell>Loading…</Shell>;

  const editable = rfq.status === 'DRAFT' || rfq.status === 'SUBMITTED';
  const cancellable = !['AWARDED', 'CLOSED'].includes(rfq.status);

  async function handleCancel() {
    if (!confirm('Cancel this RFQ? Any existing offers will be rejected.')) return;
    try {
      await api(`/api/rfqs/${params.id}/cancel`, { method: 'PATCH' });
      const updated = await api<{ rfq: RfqDetail }>(`/api/rfqs/${params.id}`);
      setRfq(updated.rfq);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel.');
    }
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">{rfq.title}</h1>
        <span className="badge">{rfq.status}</span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {rfq.status === 'REJECTED' && rfq.rejection_reason && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Rejected: {rfq.rejection_reason}
        </div>
      )}
      {rfq.status === 'SUBMITTED' && (
        <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          Pending admin review.
        </div>
      )}

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
          <span className="font-medium">Attachments:</span> {rfq.attachments.length}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {editable && (
          <Link href={`/buyer/rfqs/${rfq.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        )}
        {cancellable && (
          <button onClick={handleCancel} className="btn-danger">
            Cancel RFQ
          </button>
        )}
        <Link href={`/buyer/rfqs/${rfq.id}/offers`} className="btn-primary">
          Compare Offers ({offerCount})
        </Link>
      </div>
    </Shell>
  );
}
