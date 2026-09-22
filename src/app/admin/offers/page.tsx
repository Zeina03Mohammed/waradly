'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Offer {
  id: string;
  rfq_title: string;
  supplier_anonymized_id: string;
  unit_price: string;
  status: string;
  submitted_at: string;
  admin_flag_note: string | null;
}

export default function AdminOffersPage() {
  const { user, loading } = useRequireRole('admin');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<{ offers: Offer[] }>('/api/admin/offers').then((d) => setOffers(d.offers));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleFlag(id: string) {
    const note = prompt('Note for flagging this offer as suspicious:');
    if (!note) return;
    try {
      await api(`/api/admin/offers/${id}/flag`, { method: 'PATCH', body: { note } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not flag offer.');
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Offer Monitoring</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <table className="table-base">
        <thead>
          <tr>
            <th>RFQ</th>
            <th>Supplier</th>
            <th>Price</th>
            <th>Status</th>
            <th>Flag note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id}>
              <td>{o.rfq_title}</td>
              <td>{o.supplier_anonymized_id}</td>
              <td>{o.unit_price}</td>
              <td>
                <span className="badge">{o.status}</span>
              </td>
              <td>{o.admin_flag_note ?? '—'}</td>
              <td>
                <button onClick={() => handleFlag(o.id)} className="text-yellow-700 underline">
                  Flag Suspicious
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
