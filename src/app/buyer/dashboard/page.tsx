'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Category {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
}

interface Rfq {
  id: string;
  title: string;
  status: string;
}

export default function BuyerDashboard() {
  const { user, loading } = useRequireRole('buyer');
  const [categories, setCategories] = useState<Category[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ categories: Category[] }>('/api/categories').then((d) => setCategories(d.categories));
    api<{ rfqs: Rfq[] }>('/api/rfqs').then((d) => setRfqs(d.rfqs));
  }, [user]);

  if (loading || !user) return null;

  const openRfqs = rfqs.filter((r) => !['CLOSED', 'CANCELLED', 'EXPIRED'].includes(r.status));

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Buyer Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Open RFQs</p>
          <p className="text-2xl font-semibold">{openRfqs.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total RFQs</p>
          <p className="text-2xl font-semibold">{rfqs.length}</p>
        </div>
        <Link href="/buyer/rfqs/new" className="card flex items-center justify-center bg-gray-900 text-white hover:bg-gray-700">
          + Create RFQ
        </Link>
      </div>

      <h2 className="mb-3 text-lg font-medium">Categories</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`card text-center ${c.status !== 'active' ? 'opacity-50' : ''}`}
          >
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-gray-500">{c.status === 'active' ? 'Active' : 'Coming soon'}</p>
          </div>
        ))}
      </div>

      {rfqs.length === 0 && (
        <p className="mt-8 text-gray-600">You have no RFQs yet — create your first one.</p>
      )}
    </Shell>
  );
}
