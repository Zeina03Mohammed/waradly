'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Verification {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
  supplier: {
    id: string;
    anonymized_id: string;
    organization: { legal_name: string };
    categories: { category: { name: string } }[];
  };
}

export default function AdminSupplierVerificationPage() {
  const { user, loading } = useRequireRole('admin');
  const [items, setItems] = useState<Verification[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<{ verifications: Verification[] }>('/api/admin/suppliers/verification').then((d) => setItems(d.verifications));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleApprove(supplierId: string) {
    if (!confirm('Approve this supplier?')) return;
    try {
      await api(`/api/admin/suppliers/${supplierId}/verification`, { method: 'PATCH', body: { status: 'verified' } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve.');
    }
  }

  async function handleReject(supplierId: string) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await api(`/api/admin/suppliers/${supplierId}/verification`, { method: 'PATCH', body: { status: 'rejected', reason } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject.');
    }
  }

  return (
    <Shell>
      <h1 className="page-title mb-8">Supplier Verification</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {items.length === 0 ? (
        <p className="text-navy-400">No pending verifications.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Company</th>
              <th>Public ID</th>
              <th>Categories applied</th>
              <th>Document</th>
              <th>Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td>{v.supplier.organization.legal_name}</td>
                <td>{v.supplier.anonymized_id}</td>
                <td>{v.supplier.categories.map((c) => c.category.name).join(', ') || '—'}</td>
                <td>{v.document_type}</td>
                <td>{new Date(v.created_at).toLocaleDateString()}</td>
                <td className="space-x-2">
                  <button onClick={() => handleApprove(v.supplier.id)} className="text-green-700 underline">
                    Approve
                  </button>
                  <button onClick={() => handleReject(v.supplier.id)} className="text-red-600 underline">
                    Reject
                  </button>
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
