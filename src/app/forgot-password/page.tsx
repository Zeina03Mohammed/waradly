'use client';

import { useState } from 'react';
import { api } from '@/lib/client/apiClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/api/auth/password-reset-request', { method: 'POST', body: { email } });
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Forgot password</h1>
      {sent ? (
        <p className="text-gray-600">
          If an account exists for that email, a reset link has been sent (check the server console in dev).
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Email</span>
            <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </main>
  );
}
