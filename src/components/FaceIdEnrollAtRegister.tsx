'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { api, ApiError } from '@/lib/client/apiClient';

/**
 * One-time Face ID identity check on the register success screen — not a login method. Uses the
 * short-lived enrollment token /auth/register returns instead of a real session (none exists
 * yet, pre-verification). The resulting credential is never used again; login stays
 * email+password for every role.
 *
 * Mandatory, not optional: the parent page only reveals "Go to login" once `onEnrolled` fires,
 * so there's no way to skip this step for a supplier account. If this browser doesn't support
 * WebAuthn at all, that's a real dead end and this says so plainly rather than hiding it —
 * making the check mandatory means accepting that unsupported browsers can't finish registering.
 */
export function FaceIdEnrollAtRegister({ enrollmentToken, onEnrolled }: { enrollmentToken: string; onEnrolled: () => void }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined');
  }, []);

  async function handleEnroll() {
    setStatus('busy');
    setError(null);
    try {
      const optionsJSON = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/webauthn/register-options', {
        method: 'POST',
        token: enrollmentToken,
      });
      const response = await startRegistration({ optionsJSON });
      await api('/api/auth/webauthn/register-verify', { method: 'POST', body: { response }, token: enrollmentToken });
      setStatus('done');
      onEnrolled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set up Face ID on this device.');
      setStatus('idle');
    }
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <p className="mt-3 text-sm text-red-600">
        Face ID verification is required for supplier accounts, but this browser doesn&apos;t support it. Open this
        page in a browser with Face ID / Touch ID / Windows Hello / security key support to finish registering.
      </p>
    );
  }

  if (status === 'done') {
    return <p className="mt-3 text-sm text-green-700">Face ID verification complete.</p>;
  }

  return (
    <div className="mt-4">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={handleEnroll} disabled={status === 'busy'} className="btn-primary">
        {status === 'busy' ? 'Verifying…' : 'Verify with Face ID (required)'}
      </button>
    </div>
  );
}
