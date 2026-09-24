'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Offer {
  id: string;
  rfq_title: string;
  unit_price: string;
  status: string;
  submitted_at: string;
}

export default function MyOffersPage() {
  const { user, loading } = useRequireRole('supplier');
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ offers: Offer[] }>('/api/offers').then((d) => setOffers(d.offers));
  }, [user]);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="page-title mb-8">My Offers</h1>
      {offers.length === 0 ? (
        <p className="text-navy-400">You haven&apos;t submitted any offers yet.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>RFQ</th>
              <th>Price</th>
              <th>Status</th>
              <th>Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id}>
                <td>{o.rfq_title}</td>
                <td>{o.unit_price}</td>
                <td>
                  <span className="badge">{o.status}</span>
                </td>
                <td>{new Date(o.submitted_at).toLocaleDateString()}</td>
                <td>
                  {(o.status === 'SUBMITTED' || o.status === 'UNDER_REVIEW') && (
                    <Link href={`/supplier/offers/${o.id}/edit`} className="font-medium text-navy-600 hover:text-navy-950">
                      Edit
                    </Link>
                  )}
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
