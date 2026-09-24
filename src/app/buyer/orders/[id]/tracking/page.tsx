'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface HistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
}

interface OrderDetail {
  id: string;
  rfq_title: string;
  status_history?: HistoryEntry[];
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole('buyer');
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ order: OrderDetail }>(`/api/orders/${params.id}`).then((d) => setOrder(d.order));
  }, [user, params.id]);

  if (loading || !user) return null;
  if (!order) return <Shell>Loading…</Shell>;

  return (
    <Shell>
      <h1 className="page-title mb-8">Order Tracking — {order.rfq_title}</h1>
      <ol className="space-y-4 border-l border-navy-100 pl-4">
        {(order.status_history ?? []).map((h) => (
          <li key={h.id}>
            <p className="text-sm font-medium">{h.to_status}</p>
            <p className="text-xs text-navy-400">{new Date(h.changed_at).toLocaleString()}</p>
            {h.note && <p className="text-sm text-navy-400">{h.note}</p>}
          </li>
        ))}
      </ol>
    </Shell>
  );
}
