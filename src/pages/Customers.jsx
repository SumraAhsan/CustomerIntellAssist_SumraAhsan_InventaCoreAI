import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { db } from '../db/db';
import { Card, Badge, Button, Input, EmptyState, Modal, Field } from '../components/ui/ui';
import { createCustomer } from '../lib/repo';
import { timeAgo } from '../lib/format';
import { useApp } from '../context/useApp';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Customers() {
  const { profile } = useApp();
  const canEdit = profile?.role && profile.role !== 'Viewer';
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const customers = useLiveQuery(() => db.customers.orderBy('createdAt').reverse().toArray(), []) ?? EMPTY_ARR;
  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;

  const caseCounts = useMemo(() => {
    const map = {};
    for (const c of cases) {
      map[c.customerId] = map[c.customerId] || { total: 0, open: 0 };
      map[c.customerId].total += 1;
      if (!['Resolved', 'Closed'].includes(c.status)) map[c.customerId].open += 1;
    }
    return map;
  }, [cases]);

  const filtered = customers.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase()));

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid name and email.'); return; }
    try {
      await createCustomer({ name, email }, profile?.name || 'Agent');
      setName(''); setEmail(''); setError(''); setModalOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        {canEdit && <Button onClick={() => setModalOpen(true)} className="ml-auto"><Plus size={16} /> New customer</Button>}
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" description="Add your first customer to start logging cases." action={canEdit ? <Button onClick={() => setModalOpen(true)}>New customer</Button> : null} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-ink-faint uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium">Cases</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Last contact</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="font-medium text-ink dark:text-slate-100 hover:text-navy dark:hover:text-info">{c.name}</Link>
                      <p className="text-xs text-ink-faint">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Badge color={c.accountStatus === 'Active' ? 'success' : 'critical'}>{c.accountStatus}</Badge></td>
                    <td className="px-4 py-3 text-ink-soft dark:text-slate-300">{caseCounts[c.id]?.total || 0} <span className="text-ink-faint text-xs">({caseCounts[c.id]?.open || 0} open)</span></td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-faint">{timeAgo(c.lastContact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New customer" footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={submit}>Create</Button></>}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <p className="text-sm text-critical">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
