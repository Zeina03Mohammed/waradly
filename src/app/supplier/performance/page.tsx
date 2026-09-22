'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Supplier {
  completed_orders_count: number;
  average_rating: string | null;
}

export default function SupplierPerformancePage() {
  const { user, loading } = useRequireRole('supplier');
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ supplier: Supplier }>('/api/suppliers/me').then((d) => setSupplier(d.supplier));
  }, [user]);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Performance</h1>
      {!supplier ? (
        <p className="text-gray-600">No completed orders yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <div className="card">
            <p className="text-sm text-gray-500">Completed orders</p>
            <p className="text-2xl font-semibold">{supplier.completed_orders_count}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Average rating</p>
            <p className="text-2xl font-semibold">{supplier.average_rating ?? '—'}</p>
          </div>
        </div>
      )}
    </Shell>
  );
}
