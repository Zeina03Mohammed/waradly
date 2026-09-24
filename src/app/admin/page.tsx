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
    {
      label: 'Pending supplier approvals',
      value: data.pending_supplier_approvals,
      href: '/admin/suppliers/verification',
      accent: 'bg-gold-500',
    },
    { label: 'RFQs awaiting review', value: data.rfqs_awaiting_review, href: '/admin/rfqs/review', accent: 'bg-navy-600' },
    { label: 'Flagged messages', value: data.flagged_messages, href: '/admin/messages/flags', accent: 'bg-rose-500' },
    { label: 'Open disputes', value: data.open_disputes, href: '/admin/disputes', accent: 'bg-amber-600' },
  ];

  const statusEntries = Object.entries(data.orders_by_status);

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-navy-950">Dashboard</h1>
          <p className="mt-1 text-sm text-navy-400">An overview of what needs attention right now.</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {MORE_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-sm text-navy-600 transition-colors duration-150 hover:border-navy-400 hover:text-navy-950"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg"
          >
            <span className={`absolute inset-x-0 top-0 h-1 ${c.accent}`} />
            <p className="text-sm text-navy-400">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-navy-950">{c.value}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-navy-400 transition-colors group-hover:text-navy-600">
              View
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-navy-400">Orders by status</h2>
      <div className="flex flex-wrap gap-px overflow-hidden rounded-xl bg-navy-100 shadow-soft">
        {statusEntries.length === 0 && <p className="bg-white px-5 py-6 text-sm text-navy-400">No orders yet.</p>}
        {statusEntries.map(([status, count]) => (
          <div key={status} className="min-w-[140px] flex-1 bg-white px-5 py-4">
            <p className="text-xs capitalize text-navy-400">{status.toLowerCase().replace(/_/g, ' ')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-navy-950">{count}</p>
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
