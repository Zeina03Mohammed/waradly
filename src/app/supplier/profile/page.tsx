'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Org {
  legal_name: string;
  display_name: string | null;
  country: string;
  general_region: string;
  tax_id: string | null;
  exact_address: string | null;
}

interface Supplier {
  anonymized_id: string;
  verification_status: string;
}

export default function SupplierProfilePage() {
  const { user, loading } = useRequireRole('supplier');
  const [org, setOrg] = useState<Org | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ organization: Org }>('/api/organizations/me').then((d) => setOrg(d.organization));
    api<{ supplier: Supplier }>('/api/suppliers/me').then((d) => setSupplier(d.supplier));
  }, [user]);

  if (loading || !user || !org) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api('/api/organizations/me', { method: 'PATCH', body: org });
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save, try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Company Profile</h1>
      {supplier && (
        <p className="mb-4 text-sm text-gray-600">
          Public ID: <span className="font-medium">{supplier.anonymized_id}</span> · Status:{' '}
          <span className="badge capitalize">{supplier.verification_status}</span>
        </p>
      )}
      <form onSubmit={handleSave} className="max-w-md space-y-4">
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Legal name</span>
          <input className="input" value={org.legal_name} onChange={(e) => setOrg({ ...org, legal_name: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Country</span>
          <input className="input" value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">General region</span>
          <input className="input" value={org.general_region} onChange={(e) => setOrg({ ...org, general_region: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Tax ID (optional)</span>
          <input className="input" value={org.tax_id ?? ''} onChange={(e) => setOrg({ ...org, tax_id: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Exact address (internal use only)</span>
          <input className="input" value={org.exact_address ?? ''} onChange={(e) => setOrg({ ...org, exact_address: e.target.value })} />
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Shell>
  );
}
