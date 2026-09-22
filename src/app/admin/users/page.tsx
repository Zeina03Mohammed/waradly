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

  function load() {
    api<{ users: User[] }>('/api/admin/users').then((d) => setUsers(d.users));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleSuspend(id: string) {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    try {
      await api(`/api/admin/users/${id}/suspend`, { method: 'PATCH', body: { reason } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not suspend.');
    }
  }

  async function handleBan(id: string) {
    const reason = prompt('Reason for ban:');
    if (!reason) return;
    try {
      await api(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: { reason } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not ban.');
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
      <h1 className="mb-6 text-xl font-semibold">User Management</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
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
                    <button onClick={() => handleSuspend(u.id)} className="text-yellow-700 underline">
                      Suspend
                    </button>
                    <button onClick={() => handleBan(u.id)} className="text-red-600 underline">
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
    </Shell>
  );
}
