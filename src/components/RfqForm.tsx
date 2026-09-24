'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/client/apiClient';

export interface RfqFormValues {
  category_name: string;
  title: string;
  quantity: string;
  unit: string;
  dimensions: string;
  material: string;
  printing_customization: string;
  delivery_deadline: string;
  delivery_region: string;
  quality_requirements: string;
  sample_required: boolean;
  certifications_required: string;
  legal_compliance_requirements: string;
  offer_deadline_at: string;
}

export interface Attachment {
  file_id: string;
  filename: string;
  type: 'design' | 'certificate' | 'other';
  contains_identity_risk: boolean;
}

const EMPTY_VALUES: RfqFormValues = {
  category_name: '',
  title: '',
  quantity: '',
  unit: '',
  dimensions: '',
  material: '',
  printing_customization: '',
  delivery_deadline: '',
  delivery_region: '',
  quality_requirements: '',
  sample_required: false,
  certifications_required: '',
  legal_compliance_requirements: '',
  offer_deadline_at: '',
};

export function useRfqFormState(initial?: Partial<RfqFormValues>, initialAttachments?: Attachment[]) {
  const [values, setValues] = useState<RfqFormValues>({ ...EMPTY_VALUES, ...initial });
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments ?? []);
  return { values, setValues, attachments, setAttachments };
}

function toApiBody(values: RfqFormValues, attachments: Attachment[]) {
  return {
    category_name: values.category_name || undefined,
    title: values.title,
    quantity: values.quantity ? Number(values.quantity) : undefined,
    unit: values.unit || undefined,
    dimensions: values.dimensions || undefined,
    material: values.material || undefined,
    printing_customization: values.printing_customization || undefined,
    delivery_deadline: values.delivery_deadline ? new Date(values.delivery_deadline).toISOString() : undefined,
    delivery_region: values.delivery_region || undefined,
    quality_requirements: values.quality_requirements || undefined,
    sample_required: values.sample_required,
    certifications_required: values.certifications_required || undefined,
    legal_compliance_requirements: values.legal_compliance_requirements || undefined,
    offer_deadline_at: values.offer_deadline_at ? new Date(values.offer_deadline_at).toISOString() : undefined,
    attachments: attachments.map((a) => ({ file_id: a.file_id, type: a.type, contains_identity_risk: a.contains_identity_risk })),
  };
}

export function RfqForm({
  values,
  setValues,
  attachments,
  setAttachments,
  rfqId,
  onSaved,
}: {
  values: RfqFormValues;
  setValues: (v: RfqFormValues) => void;
  attachments: Attachment[];
  setAttachments: (a: Attachment[]) => void;
  rfqId?: string;
  onSaved?: (rfqId: string) => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof RfqFormValues>(key: K, value: RfqFormValues[K]) {
    setValues({ ...values, [key]: value });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api<{ file: { id: string; original_filename: string } }>('/api/files', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      setAttachments([
        ...attachments,
        { file_id: res.file.id, filename: res.file.original_filename, type: 'design', contains_identity_risk: false },
      ]);
    } catch (err) {
      setErrors({ attachments: err instanceof ApiError ? err.message : 'Upload failed.' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function save(mode: 'draft' | 'submit') {
    setSaving(mode);
    setErrors({});
    try {
      let id = rfqId;
      const body = toApiBody(values, attachments);
      if (id) {
        await api(`/api/rfqs/${id}`, { method: 'PATCH', body });
      } else {
        const created = await api<{ rfq: { id: string } }>('/api/rfqs', { method: 'POST', body });
        id = created.rfq.id;
      }
      if (mode === 'submit') {
        await api(`/api/rfqs/${id}/submit`, { method: 'PATCH' });
      }
      if (onSaved) onSaved(id!);
      else router.push(`/buyer/rfqs/${id}`);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? { _: err.message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {errors._ && <p className="text-sm text-red-600">{errors._}</p>}

      <section className="card space-y-3">
        <h2 className="font-medium">Category &amp; product</h2>
        <Field label="Category" error={errors.category_name}>
          <input
            className="input"
            placeholder="e.g. Custom Packaging"
            value={values.category_name}
            onChange={(e) => set('category_name', e.target.value)}
            maxLength={100}
          />
        </Field>
        <Field label="Title" error={errors.title}>
          <input className="input" value={values.title} onChange={(e) => set('title', e.target.value)} maxLength={150} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" error={errors.quantity}>
            <input type="number" min="0" className="input" value={values.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          <Field label="Unit" error={errors.unit}>
            <input className="input" placeholder="pcs, cartons…" value={values.unit} onChange={(e) => set('unit', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dimensions">
            <input className="input" value={values.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
          </Field>
          <Field label="Material">
            <input className="input" value={values.material} onChange={(e) => set('material', e.target.value)} />
          </Field>
        </div>
        <Field label="Printing / customization notes">
          <textarea className="input" value={values.printing_customization} onChange={(e) => set('printing_customization', e.target.value)} />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Requirements &amp; deadlines</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delivery deadline" error={errors.delivery_deadline}>
            <input type="date" className="input" value={values.delivery_deadline} onChange={(e) => set('delivery_deadline', e.target.value)} />
          </Field>
          <Field label="Offer deadline" error={errors.offer_deadline_at}>
            <input
              type="datetime-local"
              className="input"
              value={values.offer_deadline_at}
              onChange={(e) => set('offer_deadline_at', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Delivery region" error={errors.delivery_region}>
          <input
            className="input"
            placeholder="Region-level only, not a street address"
            value={values.delivery_region}
            onChange={(e) => set('delivery_region', e.target.value)}
          />
        </Field>
        <Field label="Quality requirements">
          <textarea className="input" value={values.quality_requirements} onChange={(e) => set('quality_requirements', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.sample_required} onChange={(e) => set('sample_required', e.target.checked)} />
          Sample required before full production
        </label>
        <Field label="Certifications required">
          <textarea className="input" value={values.certifications_required} onChange={(e) => set('certifications_required', e.target.value)} />
        </Field>
        <Field label="Legal / compliance requirements">
          <textarea
            className="input"
            value={values.legal_compliance_requirements}
            onChange={(e) => set('legal_compliance_requirements', e.target.value)}
          />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Attachments</h2>
        {errors.attachments && <p className="text-sm text-red-600">{errors.attachments}</p>}
        <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={handleFileSelect} disabled={uploading} />
        <ul className="space-y-2">
          {attachments.map((a, i) => (
            <li key={a.file_id} className="flex items-center gap-3 text-sm">
              <span className="flex-1">{a.filename}</span>
              <select
                className="input w-32"
                value={a.type}
                onChange={(e) => {
                  const next = [...attachments];
                  next[i] = { ...a, type: e.target.value as Attachment['type'] };
                  setAttachments(next);
                }}
              >
                <option value="design">design</option>
                <option value="certificate">certificate</option>
                <option value="other">other</option>
              </select>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={a.contains_identity_risk}
                  onChange={(e) => {
                    const next = [...attachments];
                    next[i] = { ...a, contains_identity_risk: e.target.checked };
                    setAttachments(next);
                  }}
                />
                watermark
              </label>
              <button type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <button type="button" disabled={saving !== null} onClick={() => save('draft')} className="btn-secondary">
          {saving === 'draft' ? 'Saving…' : 'Save as Draft'}
        </button>
        <button type="button" disabled={saving !== null} onClick={() => save('submit')} className="btn-primary">
          {saving === 'submit' ? 'Submitting…' : 'Submit for Review'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-navy-400">{label}</span>
      {children}
      {error && <span className="mt-1 block text-red-600">{error}</span>}
    </label>
  );
}
