'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Category {
  id: string;
  name: string;
  status: string;
}

export default function SupplierCategoriesPage() {
  const { user, loading } = useRequireRole('supplier');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [productionCapacity, setProductionCapacity] = useState('');
  const [materials, setMaterials] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ categories: Category[] }>('/api/categories').then((d) => setCategories(d.categories.filter((c) => c.status === 'active')));
  }, []);

  if (loading || !user) return null;

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api('/api/suppliers/categories', {
        method: 'POST',
        body: {
          category_id: categoryId,
          production_capacity: productionCapacity || undefined,
          materials_supported: materials ? materials.split(',').map((m) => m.trim()) : undefined,
        },
      });
      setMessage('Application submitted — pending admin review.');
      setCategoryId('');
      setProductionCapacity('');
      setMaterials('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Capabilities</h1>
      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleApply} className="card max-w-md space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Category</span>
          <select className="input" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Production capacity</span>
          <input className="input" placeholder="e.g. 50,000 units/month" value={productionCapacity} onChange={(e) => setProductionCapacity(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Materials supported (comma-separated)</span>
          <input className="input" value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </label>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Submitting…' : 'Apply for Category'}
        </button>
      </form>
    </Shell>
  );
}
