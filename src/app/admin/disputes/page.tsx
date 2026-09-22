'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Dispute {
  id: string;
  order_id: string;
  rfq_title: string;
  category: string;
  status: string;
  created_at: string;
}

export default function AdminDisputesPage() {
  const { user, loading } = useRequireRole('admin');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<{ disputes: Dispute[] }>('/api/admin/disputes').then((d) => setDisputes(d.disputes));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleResolve(id: string) {
    const outcome = prompt('Outcome: reopen_production, refund_manual, or close_no_action');
    if (!outcome || !['reopen_production', 'refund_manual', 'close_no_action'].includes(outcome)) return;
    const notes = prompt('Resolution notes (optional):') ?? undefined;
    try {
      await api(`/api/admin/disputes/${id}/resolve`, { method: 'PATCH', body: { outcome, notes } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve dispute.');
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Dispute Management</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {disputes.length === 0 ? (
        <p className="text-gray-600">No disputes.</p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Order / RFQ</th>
              <th>Category</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {disputes.map((d) => (
              <tr key={d.id}>
                <td>{d.rfq_title}</td>
                <td>{d.category}</td>
                <td>
                  <span className="badge">{d.status}</span>
                </td>
                <td>{new Date(d.created_at).toLocaleDateString()}</td>
                <td>
                  {d.status === 'open' && (
                    <button onClick={() => handleResolve(d.id)} className="text-blue-600 underline">
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
