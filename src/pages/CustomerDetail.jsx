import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Mail, Phone, AlertTriangle } from 'lucide-react';
import { db } from '../db/db';
import { Card, Badge, Button, EmptyState } from '../components/ui/ui';
import { PRIORITY_COLOR } from '../lib/constants';
import { formatDate, timeAgo } from '../lib/format';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function CustomerDetail() {
  const { id } = useParams();
  const customerId = Number(id);
  const validId = Number.isInteger(customerId);
  const navigate = useNavigate();

  const customer = useLiveQuery(() => (validId ? db.customers.get(customerId) : null), [customerId, validId]);
  const cases = useLiveQuery(async () => {
    if (!validId) return [];
    const list = await db.cases.where('customerId').equals(customerId).sortBy('createdAt');
    return list.reverse();
  }, [customerId, validId]) ?? EMPTY_ARR;

  if (customer === undefined) return null;
  if (!customer) {
    return <EmptyState icon={AlertTriangle} title="Customer not found" action={<Button onClick={() => navigate('/customers')}>Back to customers</Button>} />;
  }

  const open = cases.filter((c) => !['Resolved', 'Closed'].includes(c.status));
  const resolved = cases.filter((c) => ['Resolved', 'Closed'].includes(c.status));
  const escalated = cases.filter((c) => c.status === 'Escalated');

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/customers')} className="flex items-center gap-1 text-sm text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-white">
        <ArrowLeft size={15} /> Back to customers
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-1 space-y-3">
          <div className="w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center font-display text-xl font-semibold">{customer.name[0]}</div>
          <div>
            <h1 className="font-display text-lg font-semibold text-ink dark:text-white">{customer.name}</h1>
            <Badge color={customer.accountStatus === 'Active' ? 'success' : 'critical'} className="mt-1">{customer.accountStatus}</Badge>
          </div>
          <div className="text-sm text-ink-soft dark:text-slate-300 space-y-1.5">
            <p className="flex items-center gap-2"><Mail size={14} className="text-ink-faint" /> {customer.email}</p>
            {customer.phone && <p className="flex items-center gap-2"><Phone size={14} className="text-ink-faint" /> {customer.phone}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/5 dark:border-white/10">
            <div><p className="text-lg font-display font-semibold text-ink dark:text-white">{cases.length}</p><p className="text-[11px] text-ink-faint">Total cases</p></div>
            <div><p className="text-lg font-display font-semibold text-ink dark:text-white">{open.length}</p><p className="text-[11px] text-ink-faint">Open</p></div>
            <div><p className="text-lg font-display font-semibold text-ink dark:text-white">{customer.satisfaction ?? '—'}</p><p className="text-[11px] text-ink-faint">Satisfaction</p></div>
          </div>
          {escalated.length > 0 && <Badge color="critical">{escalated.length} escalated</Badge>}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Interaction timeline</h2>
          {cases.length === 0 ? (
            <EmptyState title="No cases yet" description="This customer hasn't submitted any requests." />
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <div className="w-2 h-2 rounded-full bg-navy dark:bg-info shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink dark:text-slate-100 truncate">#{c.id} · {c.subject}</p>
                    <p className="text-xs text-ink-faint">{formatDate(c.createdAt)} · {c.status} · {timeAgo(c.createdAt)}</p>
                  </div>
                  <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {resolved.length > 0 && (
        <Card>
          <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Resolved history</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resolved.map((c) => (
              <Link key={c.id} to={`/cases/${c.id}`} className="text-sm bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 truncate">#{c.id} · {c.subject}</Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
