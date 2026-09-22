'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';

interface LogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
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
      <h1 className="mb-6 text-xl font-semibold">Audit Log</h1>
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
              <td>{l.actor_id ?? 'system'}</td>
              <td>{l.action}</td>
              <td>
                {l.entity_type}:{l.entity_id.slice(0, 8)}
              </td>
              <td>
                <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="text-blue-600 underline">
                  {expanded === l.id ? 'Hide' : 'Diff'}
                </button>
                {expanded === l.id && (
                  <pre className="mt-2 max-w-md overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                    {JSON.stringify({ before: l.before_state, after: l.after_state }, null, 2)}
                  </pre>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
