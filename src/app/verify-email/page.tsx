'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/client/apiClient';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    api('/api/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Verification failed.');
      });
  }, [token]);

  return (
    <>
      {status === 'pending' && <p className="text-gray-600">Verifying…</p>}
      {status === 'success' && (
        <p className="text-green-700">
          Your email has been verified.{' '}
          <a href="/login" className="text-blue-600 underline">
            Log in
          </a>
        </p>
      )}
      {status === 'error' && <p className="text-red-600">{message}</p>}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-xl font-semibold">Email verification</h1>
      <Suspense fallback={<p className="text-gray-600">Loading…</p>}>
        <VerifyEmailInner />
      </Suspense>
    </main>
  );
}
