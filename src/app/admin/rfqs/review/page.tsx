'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface RfqRow {
  id: string;
  title: string;
  buyer_org_name: string;
  category: string | null;
  quantity: string;
  status: string;
  created_at: string;
}

export default function AdminRfqReviewPage() {
  const { user, loading } = useRequireRole('admin');
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<{ rfqs: RfqRow[] }>('/api/admin/rfqs/review').then((d) => setRfqs(d.rfqs));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleApprove(id: string) {
    if (!confirm('Approve this RFQ? Eligible suppliers will be notified.')) return;
    try {
      await api(`/api/admin/rfqs/${id}/approve`, { method: 'PATCH' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve.');
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await api(`/api/admin/rfqs/${id}/reject`, { method: 'PATCH', body: { reason } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject.');
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">RFQ Review</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {rfqs.length === 0 ? (
        <p className="text-gray-600">No RFQs awaiting review.</p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Title</th>
              <th>Buyer</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rfqs.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.buyer_org_name}</td>
                <td>{r.category ?? '—'}</td>
                <td>{r.quantity}</td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td className="space-x-2">
                  <button onClick={() => handleApprove(r.id)} className="text-green-700 underline">
                    Approve
                  </button>
                  <button onClick={() => handleReject(r.id)} className="text-red-600 underline">
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
