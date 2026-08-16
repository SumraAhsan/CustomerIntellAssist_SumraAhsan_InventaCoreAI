import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Inbox, ArrowUpDown } from 'lucide-react';
import { db } from '../db/db';
import { Card, Badge, Button, Select, Input, EmptyState } from '../components/ui/ui';
import { CATEGORIES, PRIORITIES, STATUSES, PRIORITY_COLOR, SLA_STATE_COLOR } from '../lib/constants';
import { timeAgo } from '../lib/format';
import NewCaseModal from '../components/cases/NewCaseModal';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Cases() {
  const [params, setParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const status = params.get('status') || '';
  const priority = params.get('priority') || '';
  const category = params.get('category') || '';
  const sla = params.get('sla') || '';

  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? EMPTY_ARR;
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  }

  const filtered = useMemo(() => {
    let list = cases;
    if (status) list = list.filter((c) => c.status === status);
    if (priority) list = list.filter((c) => c.priority === priority);
    if (category) list = list.filter((c) => c.category === category);
    if (sla) list = list.filter((c) => c.slaState === sla);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((c) => `${c.id} ${c.subject} ${customerMap[c.customerId]?.name || ''}`.toLowerCase().includes(term));
    }
    const sorted = [...list];
    if (sortBy === 'newest') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sortBy === 'oldest') sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sortBy === 'priority') { const order = { Critical: 0, High: 1, Medium: 2, Low: 3 }; sorted.sort((a, b) => order[a.priority] - order[b.priority]); }
    if (sortBy === 'sla') { const order = { Breached: 0, 'At Risk': 1, Healthy: 2 }; sorted.sort((a, b) => order[a.slaState] - order[b.slaState]); }
    return sorted;
  }, [cases, status, priority, category, sla, search, sortBy, customerMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search cases…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setFilter('status', e.target.value)} className="w-auto">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={priority} onChange={(e) => setFilter('priority', e.target.value)} className="w-auto">
          <option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={category} onChange={(e) => setFilter('category', e.target.value)} className="w-auto">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={sla} onChange={(e) => setFilter('sla', e.target.value)} className="w-auto">
          <option value="">All SLA states</option><option value="Healthy">Healthy</option><option value="At Risk">At Risk</option><option value="Breached">Breached</option>
        </Select>
        <button onClick={() => setSortBy(sortBy === 'newest' ? 'priority' : sortBy === 'priority' ? 'sla' : 'newest')} className="flex items-center gap-1 text-sm text-ink-soft dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
          <ArrowUpDown size={14} /> {sortBy === 'newest' ? 'Newest' : sortBy === 'priority' ? 'Priority' : 'SLA urgency'}
        </button>
        <Button onClick={() => setModalOpen(true)} className="ml-auto"><Plus size={16} /> New case</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="No cases match" description="Try adjusting your filters, or create a new case." action={<Button onClick={() => setModalOpen(true)}>New case</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-ink-faint uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                  <th className="px-4 py-3 font-medium">Case</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Customer</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium">SLA</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link to={`/cases/${c.id}`} className="font-medium text-ink dark:text-slate-100 hover:text-navy dark:hover:text-info">#{c.id} · {c.subject}</Link>
                      <p className="text-xs text-ink-faint">{c.category} · {c.department}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-ink-soft dark:text-slate-300">{customerMap[c.customerId]?.name || '—'}</td>
                    <td className="px-4 py-3"><Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge></td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-soft dark:text-slate-300">{c.status}</td>
                    <td className="px-4 py-3"><Badge color={SLA_STATE_COLOR[c.slaState]}>{c.slaState}</Badge></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-ink-faint">{timeAgo(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewCaseModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
