'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';
import { ORDER_TRANSITIONS, EVIDENCE_REQUIRED_STATUSES } from '@/lib/stateMachines/order';

interface HistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
}

interface OrderDetail {
  id: string;
  rfq_title: string;
  status: string;
  admin_notes: string | null;
  buyer: { legal_name: string };
  supplier: { anonymized_id: string };
  status_history?: HistoryEntry[];
}

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('admin');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [note, setNote] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const allowedNext = (ORDER_TRANSITIONS[order.status as keyof typeof ORDER_TRANSITIONS] ?? []) as string[];

  async function handleEvidenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api<{ file: { id: string } }>('/api/files', { method: 'POST', body: formData, isFormData: true });
      setEvidenceFileId(res.file.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleTransition(toStatus: string) {
    if (!confirm(`Change status from ${order!.status} to ${toStatus}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/orders/${params.id}/status`, {
        method: 'PATCH',
        body: { to_status: toStatus, evidence_file_id: evidenceFileId ?? undefined, note: note || undefined },
      });
      setNote('');
      setEvidenceFileId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change status.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPayment() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/orders/${params.id}/confirm-payment`, { method: 'PATCH' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm payment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenDispute() {
    const description = prompt('Describe the dispute:');
    if (!description) return;
    try {
      await api('/api/admin/disputes', { method: 'POST', body: { order_id: params.id, category: 'admin_opened', description } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open dispute.');
    }
  }

  return (
    <Shell>
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="page-title">{order.rfq_title}</h1>
        <span className="badge">{order.status}</span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card mb-4 space-y-1 text-sm">
        <p>
          <span className="font-medium">Buyer:</span> {order.buyer.legal_name}
        </p>
        <p>
          <span className="font-medium">Supplier:</span> {order.supplier.anonymized_id}
        </p>
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <button disabled={busy} onClick={handleConfirmPayment} className="btn-primary mb-4">
          Confirm Payment Received
        </button>
      )}

      {order.status !== 'DISPUTED' && allowedNext.length > 0 && (
        <div className="card mb-4 space-y-3">
          <p className="font-medium">Advance status</p>
          <textarea className="input" placeholder="Note (required for Hub/QC/delivery evidence)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input type="file" disabled={uploading} onChange={handleEvidenceUpload} />
          {evidenceFileId && <p className="text-xs text-green-700">Evidence file attached.</p>}
          <div className="flex flex-wrap gap-2">
            {allowedNext.map((status) => (
              <button
                key={status}
                disabled={busy || (EVIDENCE_REQUIRED_STATUSES.includes(status as never) && !evidenceFileId && !note)}
                onClick={() => handleTransition(status)}
                className="btn-secondary"
              >
                → {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {order.status === 'DISPUTED' && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          This order has an open dispute. Resolve it from the Disputes queue.
        </p>
      )}

      <button onClick={handleOpenDispute} className="btn-danger mb-6">
        Open Dispute
      </button>

      <h2 className="mb-2 text-lg font-medium">Status history</h2>
      <ol className="space-y-3 border-l border-navy-100 pl-4">
        {(order.status_history ?? []).map((h) => (
          <li key={h.id}>
            <p className="text-sm font-medium">
              {h.from_status ?? '—'} → {h.to_status}
            </p>
            <p className="text-xs text-navy-400">{new Date(h.changed_at).toLocaleString()}</p>
            {h.note && <p className="text-sm text-navy-400">{h.note}</p>}
          </li>
        ))}
      </ol>
    </Shell>
  );
}
