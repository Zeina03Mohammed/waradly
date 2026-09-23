'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface Dashboard {
  pending_supplier_approvals: number;
  rfqs_awaiting_review: number;
  flagged_messages: number;
  open_disputes: number;
  orders_by_status: Record<string, number>;
}

export default function AdminDashboard() {
  const { user, loading } = useRequireRole('admin');
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Dashboard>('/api/admin/dashboard').then(setData);
  }, [user]);

  if (loading || !user || !data) return null;

  const cards = [
    { label: 'Pending supplier approvals', value: data.pending_supplier_approvals, href: '/admin/suppliers/verification' },
    { label: 'RFQs awaiting review', value: data.rfqs_awaiting_review, href: '/admin/rfqs/review' },
    { label: 'Flagged messages', value: data.flagged_messages, href: '/admin/messages/flags' },
    { label: 'Open disputes', value: data.open_disputes, href: '/admin/disputes' },
  ];

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Admin Dashboard</h1>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-gray-200 pb-3 text-sm">
        {MORE_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-gray-600 hover:text-gray-900">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-2xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-medium">Orders by status</h2>
      <div className="mb-8 flex flex-wrap gap-3">
        {Object.entries(data.orders_by_status).map(([status, count]) => (
          <div key={status} className="card">
            <p className="text-xs text-gray-500">{status}</p>
            <p className="text-lg font-semibold">{count}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const MORE_LINKS = [
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/offers', label: 'Offers' },
  { href: '/admin/orders', label: 'Orders' },
];
