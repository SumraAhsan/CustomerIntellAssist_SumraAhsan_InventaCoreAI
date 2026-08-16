import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { db } from '../db/db';
import { Card, Button, Badge, EmptyState } from '../components/ui/ui';
import { timeAgo } from '../lib/format';
import { EMPTY_ARR } from '../lib/emptyArray';

const TYPE_COLOR = { info: 'info', warn: 'warn', critical: 'critical', success: 'success' };

export default function Notifications() {
  const navigate = useNavigate();
  const notifications = useLiveQuery(() => db.notifications.orderBy('createdAt').reverse().toArray(), []) ?? EMPTY_ARR;

  async function markRead(id) { await db.notifications.update(id, { read: true }); }
  async function markUnread(id) { await db.notifications.update(id, { read: false }); }
  async function markAllRead() {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    await Promise.all(ids.map((id) => db.notifications.update(id, { read: true })));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={markAllRead}><CheckCheck size={14} /> Mark all read</Button></div>

      <Card className="p-0 overflow-hidden">
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" description="You'll see updates about cases and SLA status here." />
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${!n.read ? 'bg-navy/[0.03] dark:bg-white/[0.03]' : ''}`}>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => n.relatedCaseId && navigate(`/cases/${n.relatedCaseId}`)}>
                  <p className="text-sm text-ink dark:text-slate-200">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-ink-faint">{timeAgo(n.createdAt)}</span>
                    <Badge color={TYPE_COLOR[n.type] || 'neutral'}>{n.type}</Badge>
                  </div>
                </div>
                <button onClick={() => (n.read ? markUnread(n.id) : markRead(n.id))} className="shrink-0 text-ink-faint hover:text-navy dark:hover:text-info p-1" aria-label={n.read ? 'Mark unread' : 'Mark read'}>
                  {n.read ? <Check size={16} className="opacity-40" /> : <Check size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
