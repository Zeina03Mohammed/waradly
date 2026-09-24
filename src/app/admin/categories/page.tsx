'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Category {
  id: string;
  name: string;
  status: string;
  phase: number;
}

export default function AdminCategoriesPage() {
  const { user, loading } = useRequireRole('admin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  function load() {
    api<{ categories: Category[] }>('/api/categories').then((d) => setCategories(d.categories));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api('/api/admin/categories', { method: 'POST', body: { name: newName } });
      setNewName('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create category.');
    }
  }

  async function handleToggle(cat: Category) {
    const action = cat.status === 'active' ? 'deactivate' : 'activate';
    try {
      const res = await api<{ open_rfq_count?: number }>(`/api/admin/categories/${cat.id}/${action}`, { method: 'PATCH' });
      if (action === 'deactivate' && res.open_rfq_count) {
        // informational only, per Section 7.4
        alert(`${res.open_rfq_count} RFQs are currently open in this category.`);
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update category.');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api(`/api/admin/categories/${id}`, { method: 'DELETE' });
      setConfirmingDeleteId(null);
      load();
    } catch (err) {
      setConfirmingDeleteId(null);
      setError(err instanceof ApiError ? err.message : 'Could not delete category.');
    }
  }

  return (
    <Shell>
      <h1 className="page-title mb-8">Category Management</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input className="input max-w-xs" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="btn-primary">
          Create
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
      <table className="table-base">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Phase</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>
                <span className="badge">{c.status}</span>
              </td>
              <td>{c.phase}</td>
              <td>
                <button onClick={() => handleToggle(c)} className="font-medium text-navy-600 hover:text-navy-950">
                  {c.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                {confirmingDeleteId === c.id ? (
                  <span className="ml-6 space-x-3 border-l border-navy-100 pl-6">
                    <span className="text-navy-400">Delete?</span>
                    <button onClick={() => handleDelete(c.id)} className="font-medium text-red-600 hover:text-red-700">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmingDeleteId(null)} className="font-medium text-navy-400 hover:text-navy-950">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingDeleteId(c.id)}
                    className="ml-6 border-l border-navy-100 pl-6 font-medium text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Shell>
  );
}
