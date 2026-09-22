'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface OrderDetail {
  id: string;
  rfq_title: string;
  offer: { unit_price: string; moq: string };
  supplier: { display_name: string | null; anonymized_id: string };
  status: string;
  rating: { score: number; comment: string | null } | null;
}

export default function BuyerOrderDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('buyer');
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<{ order: OrderDetail }>(`/api/orders/${params.id}`).then((d) => setOrder(d.order));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;
  if (!order) return <Shell>Loading…</Shell>;

  async function handleSampleDecision(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${params.id}/samples/decision`, { method: 'PATCH', body: { decision } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit decision.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReorder() {
    setBusy(true);
    try {
      const res = await api<{ rfq: { id: string } }>(`/api/orders/${params.id}/reorder`, { method: 'POST' });
      router.push(`/buyer/rfqs/${res.rfq.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reorder.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{order.rfq_title}</h1>
        <span className="badge">{order.status}</span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card mb-4 space-y-2 text-sm">
        <p>
          <span className="font-medium">Supplier:</span> {order.supplier.display_name ?? order.supplier.anonymized_id}
        </p>
        <p>
          <span className="font-medium">Unit price:</span> {order.offer.unit_price}
        </p>
        <p>
          <span className="font-medium">MOQ:</span> {order.offer.moq}
        </p>
      </div>

      {order.status === 'SAMPLE_REVIEW' && (
        <div className="card mb-4 space-y-3">
          <p className="font-medium">Sample ready for your review</p>
          <div className="flex gap-3">
            <button disabled={busy} onClick={() => handleSampleDecision('approve')} className="btn-primary">
              Approve Sample
            </button>
            <button disabled={busy} onClick={() => handleSampleDecision('reject')} className="btn-danger">
              Reject Sample
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href={`/buyer/orders/${order.id}/tracking`} className="btn-secondary">
          View Tracking
        </Link>
        {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && !order.rating && (
          <Link href={`/buyer/orders/${order.id}/rate`} className="btn-primary">
            Rate Supplier
          </Link>
        )}
        {order.status === 'COMPLETED' && (
          <button disabled={busy} onClick={handleReorder} className="btn-secondary">
            Reorder
          </button>
        )}
      </div>

      {order.rating && (
        <div className="card mt-4 text-sm">
          <p className="font-medium">Your rating: {order.rating.score} / 5</p>
          {order.rating.comment && <p className="text-gray-600">{order.rating.comment}</p>}
        </div>
      )}
    </Shell>
  );
}
