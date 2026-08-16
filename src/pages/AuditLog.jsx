import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Card, Select, Input, EmptyState } from '../components/ui/ui';
import { formatDate } from '../lib/format';
import { History } from 'lucide-react';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const [targetType, setTargetType] = useState('');
  const events = useLiveQuery(() => db.auditEvents.orderBy('timestamp').reverse().limit(500).toArray(), []) ?? EMPTY_ARR;

  const filtered = events.filter((e) => {
    const matchesType = !targetType || e.targetType === targetType;
    const matchesSearch = !search.trim() || `${e.actor} ${e.action} ${e.details}`.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search audit log…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="w-auto">
          <option value="">All types</option>
          <option value="case">Cases</option>
          <option value="customer">Customers</option>
          <option value="knowledge">Knowledge base</option>
          <option value="workspace">Workspace</option>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={History} title="No matching audit events" />
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[70vh] overflow-y-auto scrollbar-thin">
            {filtered.map((e) => (
              <div key={e.id} className="px-4 py-3 text-sm">
                <p className="text-ink dark:text-slate-200">
                  <span className="font-medium">{e.actor}</span> {e.action}
                  {e.targetType !== 'workspace' && <span className="text-ink-faint"> · {e.targetType} #{e.targetId}</span>}
                  {e.details && <span className="text-ink-soft dark:text-slate-400"> — {e.details}</span>}
                </p>
                <p className="text-xs text-ink-faint mt-0.5">{formatDate(e.timestamp)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
