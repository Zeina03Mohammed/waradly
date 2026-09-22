'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/client/apiClient';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/password-reset', { method: 'POST', body: { token, new_password: newPassword } });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <p className="text-green-700">Password reset. Redirecting to login…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">New password</span>
        <input type="password" required className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </label>
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Reset password</h1>
      <Suspense fallback={<p className="text-gray-600">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
