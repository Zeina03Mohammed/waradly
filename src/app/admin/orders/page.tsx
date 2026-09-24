'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Order {
  id: string;
  rfq_title: string;
  buyer_org_name: string;
  supplier_anonymized_id: string;
  status: string;
  created_at: string;
}

export default function AdminOrdersPage() {
  const { user, loading } = useRequireRole('admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = statusFilter ? `?status=${statusFilter}` : '';
    api<{ orders: Order[] }>(`/api/admin/orders${q}`).then((d) => setOrders(d.orders));
  }, [user, statusFilter]);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="page-title mb-8">Order Management</h1>
      <input
        className="input mb-4 max-w-xs"
        placeholder="Filter by status (e.g. PRODUCTION)"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      />
      <div className="card overflow-x-auto p-0">
      <table className="table-base">
        <thead>
          <tr>
            <th>RFQ</th>
            <th>Buyer</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.rfq_title}</td>
              <td>{o.buyer_org_name}</td>
              <td>{o.supplier_anonymized_id}</td>
              <td>
                <span className="badge">{o.status}</span>
              </td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
              <td>
                <Link href={`/admin/orders/${o.id}`} className="font-medium text-navy-600 hover:text-navy-950">
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Shell>
  );
}
