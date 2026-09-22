'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface OrderDetail {
  id: string;
  rfq_title: string;
  status: string;
  sample_required: boolean;
  buyer: { display_name: string | null; general_region: string };
  offer: { unit_price: string; moq: string };
}

export default function SupplierOrderDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('supplier');
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

  async function handleAction(action: 'mark-production-started' | 'mark-production-completed') {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${params.id}/${action}`, { method: 'PATCH' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSampleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await api<{ file: { id: string } }>('/api/files', { method: 'POST', body: formData, isFormData: true });
      await api(`/api/orders/${params.id}/samples`, { method: 'POST', body: { evidence_file_id: uploaded.file.id } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit sample.');
    } finally {
      setBusy(false);
      e.target.value = '';
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
          <span className="font-medium">Buyer region:</span> {order.buyer.general_region}
        </p>
        <p>
          <span className="font-medium">Unit price:</span> {order.offer.unit_price}
        </p>
        <p>
          <span className="font-medium">MOQ:</span> {order.offer.moq}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {order.status === 'PAYMENT_CONFIRMED' && (
          <button disabled={busy} onClick={() => handleAction('mark-production-started')} className="btn-primary">
            Mark Production Started
          </button>
        )}
        {order.sample_required && order.status === 'PRODUCTION' && (
          <label className="btn-secondary cursor-pointer">
            Submit Sample
            <input type="file" className="hidden" disabled={busy} onChange={handleSampleUpload} />
          </label>
        )}
        {order.status === 'PRODUCTION' && (
          <button disabled={busy} onClick={() => handleAction('mark-production-completed')} className="btn-primary">
            Mark Production Completed
          </button>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Hub receipt, QC, courier hand-off, and delivery stages are managed by Admin and shown read-only here via the
        order status above.
      </p>
    </Shell>
  );
}
