'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Offer {
  id: string;
  supplier: { display_name: string | null; anonymized_id: string; completed_orders_count: number; average_rating: string | null; general_region: string };
  unit_price: string;
  moq: string;
  production_lead_time_days: number;
  delivery_time_estimate_days: number;
  shipping_estimate_notes: string | null;
  sample_availability: boolean;
  payment_terms: string | null;
  technical_specs_notes: string | null;
  quality_notes: string | null;
  status: string;
}

export default function OfferComparisonPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('buyer');
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  function load() {
    api<{ offers: Offer[] }>(`/api/rfqs/${params.id}/offers`).then((d) => setOffers(d.offers));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleAccept(offerId: string) {
    if (!confirm('Accept this offer? This will reject all other offers on this RFQ.')) return;
    setAccepting(offerId);
    setError(null);
    try {
      const res = await api<{ order: { id: string } }>(`/api/offers/${offerId}/accept`, { method: 'PATCH' });
      router.push(`/buyer/orders/${res.order.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This offer is no longer available, please refresh.');
        load();
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not accept offer.');
      }
    } finally {
      setAccepting(null);
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Compare Offers</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {offers.length === 0 ? (
        <p className="text-gray-600">No offers received yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Price</th>
                <th>MOQ</th>
                <th>Lead time</th>
                <th>Delivery est.</th>
                <th>Sample</th>
                <th>Rating</th>
                <th>Completed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id}>
                  <td>{o.supplier.display_name ?? o.supplier.anonymized_id}</td>
                  <td>{o.unit_price}</td>
                  <td>{o.moq}</td>
                  <td>{o.production_lead_time_days}d</td>
                  <td>{o.delivery_time_estimate_days}d</td>
                  <td>{o.sample_availability ? 'Yes' : 'No'}</td>
                  <td>{o.supplier.average_rating ?? '—'}</td>
                  <td>{o.supplier.completed_orders_count}</td>
                  <td>
                    {o.status === 'SUBMITTED' || o.status === 'UNDER_REVIEW' ? (
                      <button onClick={() => handleAccept(o.id)} disabled={accepting === o.id} className="btn-primary">
                        {accepting === o.id ? 'Accepting…' : 'Accept'}
                      </button>
                    ) : (
                      <span className="badge">{o.status}</span>
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
