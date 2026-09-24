'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  org_name: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const { user, loading } = useRequireRole('admin');
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; kind: 'suspend' | 'ban' } | null>(null);
  const [reason, setReason] = useState('');

  function load() {
    api<{ users: User[] }>('/api/admin/users').then((d) => setUsers(d.users));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function submitReason() {
    if (!pending || !reason.trim()) return;
    try {
      await api(`/api/admin/users/${pending.id}/${pending.kind}`, { method: 'PATCH', body: { reason } });
      setPending(null);
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${pending.kind}.`);
    }
  }

  async function handleReactivate(id: string) {
    try {
      await api(`/api/admin/users/${id}/reactivate`, { method: 'PATCH' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reactivate.');
    }
  }

  return (
    <Shell>
      <h1 className="page-title mb-8">User Management</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="card overflow-x-auto p-0">
      <table className="table-base">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Org</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.org_name ?? '—'}</td>
              <td>
                <span className="badge">{u.status}</span>
              </td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="space-x-2">
                {u.status === 'active' && (
                  <>
                    <button
                      onClick={() => {
                        setPending({ id: u.id, kind: 'suspend' });
                        setReason('');
                      }}
                      className="text-yellow-700 underline"
                    >
                      Suspend
                    </button>
                    <button
                      onClick={() => {
                        setPending({ id: u.id, kind: 'ban' });
                        setReason('');
                      }}
                      className="text-red-600 underline"
                    >
                      Ban
                    </button>
                  </>
                )}
                {u.status !== 'active' && (
                  <button onClick={() => handleReactivate(u.id)} className="text-green-700 underline">
                    Reactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {pending && (
        <div className="fixed inset-0 flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-soft-lg">
            <h2 className="mb-3 text-lg font-semibold capitalize text-navy-950">Reason for {pending.kind}</h2>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input mb-4 w-full"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setPending(null);
                  setReason('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={submitReason} disabled={!reason.trim()} className="btn-primary">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
