import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { db } from '../db/db';
import { Card, Badge, EmptyState } from '../components/ui/ui';
import { PRIORITY_COLOR, SLA_STATE_COLOR } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { useApp } from '../context/useApp';
import { EMPTY_ARR } from '../lib/emptyArray';

const SECTIONS = [
  { key: 'New', label: 'New', match: (c) => c.status === 'Open' && !c.assignedAgentId },
  { key: 'InProgress', label: 'In Progress', match: (c) => ['Assigned', 'In Progress'].includes(c.status) },
  { key: 'Waiting', label: 'Waiting', match: (c) => c.status === 'Waiting for Customer' },
  { key: 'AtRisk', label: 'SLA At Risk', match: (c) => c.slaState === 'At Risk' && !['Resolved', 'Closed'].includes(c.status) },
  { key: 'Escalated', label: 'Escalated', match: (c) => c.status === 'Escalated' },
];

export default function Queue() {
  const { profile } = useApp();
  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;
  const agents = useLiveQuery(() => db.agents.toArray(), []) ?? EMPTY_ARR;
  const me = agents.find((a) => a.name === profile?.name);

  const isManagerOrAdmin = profile?.role === 'Administrator' || profile?.role === 'Manager';
  const scoped = isManagerOrAdmin || !me ? cases : cases.filter((c) => c.assignedAgentId === me.id);
  const active = scoped.filter((c) => !['Resolved', 'Closed'].includes(c.status));

  return (
    <div className="space-y-6">
      {!isManagerOrAdmin && !me && (
        <div className="rounded-lg bg-info-soft text-info text-sm px-3 py-2">
          Showing all active cases — your name doesn't match a seeded team member, so a personal queue can't be scoped yet.
        </div>
      )}
      {SECTIONS.map((section) => {
        const items = active.filter(section.match).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return (
          <div key={section.key}>
            <h2 className="font-display font-semibold text-ink dark:text-white mb-2 flex items-center gap-2">
              {section.label} <span className="text-xs font-normal text-ink-faint">({items.length})</span>
            </h2>
            {items.length === 0 ? (
              <Card><EmptyState icon={ListChecks} title="Nothing here" description="Your queue is clear for this section." /></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((c) => (
                  <Link key={c.id} to={`/cases/${c.id}`}>
                    <Card className="hover:shadow-pop transition-shadow h-full">
                      <p className="text-sm font-medium text-ink dark:text-slate-100 truncate mb-1">#{c.id} · {c.subject}</p>
                      <p className="text-xs text-ink-faint mb-2">{timeAgo(c.createdAt)}</p>
                      <div className="flex items-center gap-2">
                        <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
                        <Badge color={SLA_STATE_COLOR[c.slaState]}>{c.slaState}</Badge>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
