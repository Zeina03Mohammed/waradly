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

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Category Management</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input className="input max-w-xs" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="btn-primary">
          Create
        </button>
      </form>

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
                <button onClick={() => handleToggle(c)} className="text-blue-600 underline">
                  {c.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
