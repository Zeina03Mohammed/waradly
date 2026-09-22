'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface SupplierRow {
  id: string;
  anonymized_id: string;
  approved_for_category: boolean;
  included: boolean;
}

export default function AdminRfqDistributionPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('admin');
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ suppliers: SupplierRow[] }>(`/api/admin/rfqs/${params.id}/distribution`).then((d) => setSuppliers(d.suppliers));
  }, [user, params.id]);

  if (loading || !user) return null;

  function toggle(id: string) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, included: !s.included } : s)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/rfqs/${params.id}/distribution`, {
        method: 'PATCH',
        body: { supplier_ids: suppliers.filter((s) => s.included).map((s) => s.id) },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save distribution.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">RFQ Distribution</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <p className="mb-4 text-sm text-gray-600">
        Default: all suppliers approved for this category. Uncheck to exclude, or check a supplier not otherwise approved
        to include them anyway (visibility only — they still can&apos;t submit an offer without category approval).
      </p>
      <table className="table-base mb-4">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Approved for category</th>
            <th>Include</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td>{s.anonymized_id}</td>
              <td>{s.approved_for_category ? 'Yes' : 'No'}</td>
              <td>
                <input type="checkbox" checked={s.included} onChange={() => toggle(s.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save distribution list'}
      </button>
    </Shell>
  );
}
