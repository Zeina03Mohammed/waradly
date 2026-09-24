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
  category_id: string | null;
  created_at: string;
}

export default function BuyerRfqsPage() {
  const { user, loading } = useRequireRole('buyer');
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user) return;
    const params = statusFilter ? `?status=${statusFilter}` : '';
    api<{ rfqs: Rfq[] }>(`/api/rfqs${params}`).then((d) => setRfqs(d.rfqs));
  }, [user, statusFilter]);

  if (loading || !user) return null;

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">My RFQs</h1>
        <Link href="/buyer/rfqs/new" className="btn-primary">
          + Create RFQ
        </Link>
      </div>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input mb-4 max-w-xs">
        <option value="">All statuses</option>
        {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'PUBLISHED', 'RECEIVING_OFFERS', 'AWARDED', 'EXPIRED', 'CANCELLED', 'CLOSED'].map(
          (s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ),
        )}
      </select>

      {rfqs.length === 0 ? (
        <p className="text-navy-400">You haven&apos;t created any RFQs yet.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
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
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <Link href={`/buyer/rfqs/${r.id}`} className="font-medium text-navy-600 hover:text-navy-950">
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
