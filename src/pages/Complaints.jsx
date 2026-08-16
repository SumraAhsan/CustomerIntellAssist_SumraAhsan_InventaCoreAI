import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { db } from '../db/db';
import { Card, Badge, Select, EmptyState } from '../components/ui/ui';
import { PRIORITY_COLOR, SLA_STATE_COLOR, DEPARTMENTS, CATEGORIES } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { EMPTY_ARR } from '../lib/emptyArray';

const FILTERS = ['All', 'Unresolved', 'Escalated', 'High priority', 'Repeat complaints', 'Overdue'];

export default function Complaints() {
  const [filter, setFilter] = useState('Unresolved');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');

  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? EMPTY_ARR;
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const repeatCustomerIds = useMemo(() => {
    const counts = {};
    for (const c of cases) counts[c.customerId] = (counts[c.customerId] || 0) + 1;
    return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([id]) => Number(id)));
  }, [cases]);

  const filtered = useMemo(() => {
    let list = cases;
    if (filter === 'Unresolved') list = list.filter((c) => !['Resolved', 'Closed'].includes(c.status));
    if (filter === 'Escalated') list = list.filter((c) => c.status === 'Escalated');
    if (filter === 'High priority') list = list.filter((c) => ['High', 'Critical'].includes(c.priority));
    if (filter === 'Repeat complaints') list = list.filter((c) => repeatCustomerIds.has(c.customerId));
    if (filter === 'Overdue') list = list.filter((c) => c.slaState === 'Breached');
    if (department) list = list.filter((c) => c.department === department);
    if (category) list = list.filter((c) => c.category === category);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [cases, filter, department, category, repeatCustomerIds]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-sm px-3 py-1.5 rounded-lg ${filter === f ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-white/10 text-ink-soft dark:text-slate-300'}`}>{f}</button>
        ))}
        <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-auto ml-auto">
          <option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={AlertTriangle} title="No matching complaints" description="Nothing fits this filter combination right now." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`}>
              <Card className="hover:shadow-pop transition-shadow h-full">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm text-ink dark:text-slate-100 truncate">#{c.id} · {c.subject}</p>
                  <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
                </div>
                <p className="text-xs text-ink-faint mb-2">{customerMap[c.customerId]?.name || 'Unknown'} · {timeAgo(c.createdAt)}</p>
                <div className="flex items-center gap-2">
                  <Badge color={SLA_STATE_COLOR[c.slaState]}>{c.slaState}</Badge>
                  {repeatCustomerIds.has(c.customerId) && <Badge color="intel">Repeat customer</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
