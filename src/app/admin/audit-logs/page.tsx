'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface LogEntry {
  id: string;
  actor_id: string | null;
  actor: { email: string; phone: string | null } | null;
  action: string;
  entity_type: string;
  entity_type_label: string;
  entity_id: string;
  entity_label: string | null;
  created_at: string;
  before_state: unknown;
  after_state: unknown;
}

export default function AdminAuditLogsPage() {
  const { user, loading } = useRequireRole('admin');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ logs: LogEntry[] }>('/api/admin/audit-logs').then((d) => setLogs(d.logs));
  }, [user]);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="page-title mb-8">Audit Log</h1>
      <div className="card overflow-x-auto p-0">
      <table className="table-base">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.created_at).toLocaleString()}</td>
              <td>
                {l.actor ? (
                  <>
                    {l.actor.email}
                    {l.actor.phone && <span className="text-navy-400"> · {l.actor.phone}</span>}
                  </>
                ) : (
                  'system'
                )}
              </td>
              <td>{l.action}</td>
              <td>
                {l.entity_label ?? `${l.entity_type_label} (deleted)`}
                <span className="text-navy-400"> · {l.entity_type_label}</span>
              </td>
              <td>
                <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="font-medium text-navy-600 hover:text-navy-950">
                  {expanded === l.id ? 'Hide' : 'Diff'}
                </button>
                {expanded === l.id && (
                  <pre className="mt-2 max-w-md overflow-x-auto rounded-md bg-navy-50 p-2 text-xs text-navy-700">
                    {JSON.stringify({ before: l.before_state, after: l.after_state }, null, 2)}
                  </pre>
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
