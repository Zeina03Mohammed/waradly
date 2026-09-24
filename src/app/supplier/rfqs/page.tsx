'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Rfq {
  id: string;
  title: string;
  status: string;
  offer_deadline_at: string | null;
}

export default function SupplierRfqFeedPage() {
  const { user, loading } = useRequireRole('supplier');
  const [rfqs, setRfqs] = useState<Rfq[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ rfqs: Rfq[] }>('/api/rfqs').then((d) => setRfqs(d.rfqs));
  }, [user]);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="page-title mb-8">Available RFQs</h1>
      {rfqs.length === 0 ? (
        <p className="text-navy-400">No RFQs available in your categories yet.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Offer deadline</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rfqs.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>{r.offer_deadline_at ? new Date(r.offer_deadline_at).toLocaleString() : '—'}</td>
                <td>
                  <Link href={`/supplier/rfqs/${r.id}`} className="font-medium text-navy-600 hover:text-navy-950">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Shell>
  );
}
