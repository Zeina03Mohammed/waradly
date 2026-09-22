'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Supplier {
  verification_status: 'pending' | 'verified' | 'rejected';
  anonymized_id: string;
}

export default function SupplierVerificationPage() {
  const { user, loading } = useRequireRole('supplier');
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [docType, setDocType] = useState<'commercial_registration' | 'certificate' | 'other'>('commercial_registration');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ supplier: Supplier }>('/api/suppliers/me').then((d) => setSupplier(d.supplier));
  }, [user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);
      await api('/api/suppliers/verification-documents', { method: 'POST', body: formData, isFormData: true });
      setMessage('Document submitted for review.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Verification Status</h1>
      {supplier && <span className="badge mb-4 inline-block capitalize">{supplier.verification_status}</span>}

      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card max-w-md space-y-3">
        <p className="text-sm text-gray-600">
          Upload a commercial registration document (or other supporting certificate) for Admin to review.
        </p>
        <select className="input" value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)}>
          <option value="commercial_registration">Commercial registration</option>
          <option value="certificate">Certificate</option>
          <option value="other">Other</option>
        </select>
        <input type="file" accept="image/png,image/jpeg,application/pdf" disabled={uploading} onChange={handleUpload} />
      </div>
    </Shell>
  );
}
