'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Flag {
  id: string;
  message_excerpt: string;
  sender_email: string;
  detected_pattern_type: string;
  status: string;
  created_at: string;
}

export default function AdminMessageFlagsPage() {
  const { user, loading } = useRequireRole('admin');
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<{ flags: Flag[] }>('/api/admin/messages/flags?status=pending_review').then((d) => setFlags(d.flags));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleAction(id: string, action: 'dismiss' | 'warning' | 'strike' | 'suspension' | 'ban') {
    if (action !== 'dismiss' && !confirm(`Apply "${action}" to this user?`)) return;
    try {
      await api(`/api/admin/messages/flags/${id}`, { method: 'PATCH', body: { action } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update flag.');
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Message Flag Review</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {flags.length === 0 ? (
        <p className="text-gray-600">No pending flagged messages.</p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Excerpt</th>
              <th>Sender</th>
              <th>Pattern</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id}>
                <td className="max-w-xs truncate">{f.message_excerpt}</td>
                <td>{f.sender_email}</td>
                <td>{f.detected_pattern_type}</td>
                <td className="space-x-2 whitespace-nowrap">
                  <button onClick={() => handleAction(f.id, 'dismiss')} className="text-gray-600 underline">
                    Dismiss
                  </button>
                  <button onClick={() => handleAction(f.id, 'warning')} className="text-yellow-700 underline">
                    Warning
                  </button>
                  <button onClick={() => handleAction(f.id, 'strike')} className="text-orange-700 underline">
                    Strike
                  </button>
                  <button onClick={() => handleAction(f.id, 'suspension')} className="text-red-600 underline">
                    Suspend
                  </button>
                  <button onClick={() => handleAction(f.id, 'ban')} className="text-red-800 underline">
                    Ban
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
