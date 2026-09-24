'use client';

import { useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  flagged: boolean;
  created_at: string;
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const { user, loading } = useRequireRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    api<{ messages: Message[] }>(`/api/conversations/${params.id}/messages`)
      .then((d) => setMessages(d.messages))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load messages.'));
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading || !user) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/conversations/${params.id}/messages`, { method: 'POST', body: { content: draft } });
      setDraft('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell>
      <h1 className="page-title mb-6">Messages</h1>
      <p className="mb-4 text-xs text-navy-400">
        Messages are monitored. Sharing phone numbers, emails, or links is against the Anti-Circumvention Policy and
        will be redacted for the other party and reviewed by Admin.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card mb-4 max-h-96 space-y-3 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-navy-400">No messages yet.</p>}
        {messages.map((m) => {
          const isMine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded px-3 py-2 text-sm ${isMine ? 'bg-navy-950 text-white' : 'bg-navy-50 text-navy-950'}`}>
                <p>{m.content}</p>
                {m.flagged && <p className="mt-1 text-xs opacity-70">⚠ contains redacted contact info</p>}
                <p className="mt-1 text-xs opacity-60">{new Date(m.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={sending} className="btn-primary">
          Send
        </button>
      </form>
    </Shell>
  );
}
