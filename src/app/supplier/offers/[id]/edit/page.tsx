'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Offer {
  id: string;
  unit_price: string;
  moq: string;
  production_lead_time_days: number;
  delivery_time_estimate_days: number;
  shipping_estimate_notes: string | null;
  sample_availability: boolean;
  sample_terms: string | null;
  payment_terms: string | null;
  technical_specs_notes: string | null;
  quality_notes: string | null;
}

export default function EditOfferPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('supplier');
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ offer: Offer }>(`/api/offers/${params.id}`)
      .then((d) => setOffer(d.offer))
      .catch(() => setForbidden(true));
  }, [user, params.id]);

  if (loading || !user) return null;
  if (forbidden) return <Shell><p className="text-red-600">This offer can no longer be modified.</p></Shell>;
  if (!offer) return <Shell>Loading…</Shell>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!offer) return;
    setSaving(true);
    setErrors({});
    try {
      await api(`/api/offers/${params.id}`, {
        method: 'PATCH',
        body: {
          unit_price: Number(offer.unit_price),
          moq: Number(offer.moq),
          production_lead_time_days: offer.production_lead_time_days,
          delivery_time_estimate_days: offer.delivery_time_estimate_days,
          shipping_estimate_notes: offer.shipping_estimate_notes ?? undefined,
          sample_availability: offer.sample_availability,
          sample_terms: offer.sample_terms ?? undefined,
          payment_terms: offer.payment_terms ?? undefined,
          technical_specs_notes: offer.technical_specs_notes ?? undefined,
          quality_notes: offer.quality_notes ?? undefined,
        },
      });
      router.push('/supplier/offers');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? { _: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleWithdraw() {
    if (!confirm('Withdraw this offer?')) return;
    try {
      await api(`/api/offers/${params.id}/withdraw`, { method: 'PATCH' });
      router.push('/supplier/offers');
    } catch (err) {
      setErrors({ _: err instanceof ApiError ? err.message : 'Could not withdraw.' });
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Edit Offer</h1>
      <form onSubmit={handleSave} className="card max-w-md space-y-3">
        {errors._ && <p className="text-sm text-red-600">{errors._}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Unit price</span>
          <input type="number" step="0.01" className="input" value={offer.unit_price} onChange={(e) => setOffer({ ...offer, unit_price: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">MOQ</span>
          <input type="number" className="input" value={offer.moq} onChange={(e) => setOffer({ ...offer, moq: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Production lead time (days)</span>
          <input
            type="number"
            className="input"
            value={offer.production_lead_time_days}
            onChange={(e) => setOffer({ ...offer, production_lead_time_days: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Delivery time estimate (days)</span>
          <input
            type="number"
            className="input"
            value={offer.delivery_time_estimate_days}
            onChange={(e) => setOffer({ ...offer, delivery_time_estimate_days: Number(e.target.value) })}
          />
        </label>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={handleWithdraw} className="btn-danger">
            Withdraw Offer
          </button>
        </div>
      </form>
    </Shell>
  );
}
