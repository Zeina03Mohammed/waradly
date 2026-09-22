'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

export default function RateOrderPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('buyer');
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/orders/${params.id}/rate`, { method: 'POST', body: { score, comment: comment || undefined } });
      router.push(`/buyer/orders/${params.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit rating.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Rate Supplier</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Score (1-5)</span>
          <select className="input" value={score} onChange={(e) => setScore(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Comment (optional)</span>
          <textarea className="input" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </button>
      </form>
    </Shell>
  );
}
