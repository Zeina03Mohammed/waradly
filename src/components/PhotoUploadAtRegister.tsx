'use client';

import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client/apiClient';

/** Register-success-screen photo upload — same enrollment-token auth as FaceIdEnrollAtRegister,
 * since no real session exists yet (pre-verification). Mandatory: the parent page only reveals
 * the Face ID step once `onUploaded` fires. */
export function PhotoUploadAtRegister({ enrollmentToken, onUploaded }: { enrollmentToken: string; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api('/api/users/me/avatar', { method: 'POST', body: formData, isFormData: true, token: enrollmentToken });
      setDone(true);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (done) {
    return <p className="mt-3 text-sm text-green-700">Photo uploaded.</p>;
  }

  return (
    <div className="mt-4">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="btn-primary"
      >
        {uploading ? 'Uploading…' : 'Upload your photo (required)'}
      </button>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleChange} />
    </div>
  );
}
