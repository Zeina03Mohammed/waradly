'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/client/apiClient';
import { useAuth } from '@/lib/client/AuthProvider';

const DASHBOARD_BY_ROLE: Record<string, string> = {
  buyer: '/buyer/dashboard',
  supplier: '/supplier/rfqs',
  admin: '/admin',
};

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(DASHBOARD_BY_ROLE[user.role] ?? '/');
  }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      router.replace(DASHBOARD_BY_ROLE[loggedInUser.role] ?? '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </label>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        No account yet?{' '}
        <a href="/register" className="text-blue-600 underline">
          Register
        </a>
      </p>
      <p className="mt-2 text-sm text-gray-600">
        <a href="/forgot-password" className="text-blue-600 underline">
          Forgot password?
        </a>
      </p>
    </main>
  );
}
