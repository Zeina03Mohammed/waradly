'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

export default function SubmitOfferPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('supplier');
  const router = useRouter();
  const [unitPrice, setUnitPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [productionLeadTime, setProductionLeadTime] = useState('');
  const [deliveryEstimate, setDeliveryEstimate] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [sampleAvailable, setSampleAvailable] = useState(false);
  const [sampleTerms, setSampleTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (loading || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await api(`/api/rfqs/${params.id}/offers`, {
        method: 'POST',
        body: {
          unit_price: Number(unitPrice),
          moq: Number(moq),
          production_lead_time_days: Number(productionLeadTime),
          delivery_time_estimate_days: Number(deliveryEstimate),
          shipping_estimate_notes: shippingNotes || undefined,
          sample_availability: sampleAvailable,
          sample_terms: sampleTerms || undefined,
          payment_terms: paymentTerms || undefined,
          technical_specs_notes: technicalNotes || undefined,
          quality_notes: qualityNotes || undefined,
        },
      });
      router.push('/supplier/offers');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? { _: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <h1 className="page-title mb-8">Submit Offer</h1>
      <form onSubmit={handleSubmit} className="card max-w-md space-y-3">
        {errors._ && <p className="text-sm text-red-600">{errors._}</p>}
        <F label="Unit price" error={errors.unit_price}>
          <input type="number" step="0.01" min="0" required className="input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </F>
        <F label="MOQ" error={errors.moq}>
          <input type="number" min="0" required className="input" value={moq} onChange={(e) => setMoq(e.target.value)} />
        </F>
        <F label="Production lead time (days)" error={errors.production_lead_time_days}>
          <input type="number" min="1" required className="input" value={productionLeadTime} onChange={(e) => setProductionLeadTime(e.target.value)} />
        </F>
        <F label="Delivery time estimate (days)" error={errors.delivery_time_estimate_days}>
          <input type="number" min="1" required className="input" value={deliveryEstimate} onChange={(e) => setDeliveryEstimate(e.target.value)} />
        </F>
        <F label="Shipping estimate notes">
          <textarea className="input" value={shippingNotes} onChange={(e) => setShippingNotes(e.target.value)} />
        </F>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sampleAvailable} onChange={(e) => setSampleAvailable(e.target.checked)} />
          Sample available
        </label>
        {sampleAvailable && (
          <F label="Sample terms" error={errors.sample_terms}>
            <input className="input" value={sampleTerms} onChange={(e) => setSampleTerms(e.target.value)} />
          </F>
        )}
        <F label="Payment terms">
          <input className="input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        </F>
        <F label="Technical specs notes">
          <textarea className="input" value={technicalNotes} onChange={(e) => setTechnicalNotes(e.target.value)} />
        </F>
        <F label="Quality notes">
          <textarea className="input" value={qualityNotes} onChange={(e) => setQualityNotes(e.target.value)} />
        </F>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Submitting…' : 'Submit Offer'}
        </button>
      </form>
    </Shell>
  );
}

function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-navy-400">{label}</span>
      {children}
      {error && <span className="mt-1 block text-red-600">{error}</span>}
    </label>
  );
}
