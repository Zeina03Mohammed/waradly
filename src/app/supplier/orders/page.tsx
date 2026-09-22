'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Order {
  id: string;
  rfq_title: string;
  status: string;
  created_at: string;
  buyer: { general_region: string };
}

export default function SupplierOrdersPage() {
  const { user, loading } = useRequireRole('supplier');
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ orders: Order[] }>('/api/orders').then((d) => setOrders(d.orders));
  }, [user]);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Won Orders</h1>
      {orders.length === 0 ? (
        <p className="text-gray-600">No orders yet.</p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>RFQ</th>
              <th>Buyer region</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.rfq_title}</td>
                <td>{o.buyer.general_region}</td>
                <td>
                  <span className="badge">{o.status}</span>
                </td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td>
                  <Link href={`/supplier/orders/${o.id}`} className="text-blue-600 underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
