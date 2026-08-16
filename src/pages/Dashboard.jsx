import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, Link } from 'react-router-dom';
import { Inbox, AlertTriangle, Clock, CheckCircle2, TrendingUp, Smile } from 'lucide-react';
import { db } from '../db/db';
import { computeDashboardMetrics, detectRecurringIssues } from '../lib/repo';
import { Card, Badge, EmptyState, Button } from '../components/ui/ui';
import { PRIORITY_COLOR, SLA_STATE_COLOR } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { useApp } from '../context/useApp';
import { EMPTY_ARR } from '../lib/emptyArray';

const ICON_BG = {
  navy: 'bg-navy/10 dark:bg-white/10',
  warn: 'bg-warn-soft dark:bg-warn/20',
  critical: 'bg-critical-soft dark:bg-critical/20',
  success: 'bg-success-soft dark:bg-success/20',
  info: 'bg-info-soft dark:bg-info/20',
  intel: 'bg-intel-soft dark:bg-intel/20',
};
const ICON_COLOR = {
  navy: 'text-navy dark:text-slate-100',
  warn: 'text-warn dark:text-amber-300',
  critical: 'text-critical dark:text-red-300',
  success: 'text-success dark:text-emerald-300',
  info: 'text-info dark:text-blue-300',
  intel: 'text-intel dark:text-violet-300',
};

function StatCard({ icon: Icon, label, value, color = 'navy', onClick }) {
  return (
    <Card onClick={onClick} className={`flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-pop transition-shadow' : ''}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ICON_BG[color]}`}>
        <Icon size={20} className={ICON_COLOR[color]} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-semibold text-ink dark:text-white leading-tight">{value}</p>
        <p className="text-xs text-ink-soft dark:text-slate-400">{label}</p>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { now } = useApp();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [recurring, setRecurring] = useState([]);

  useEffect(() => {
    computeDashboardMetrics().then(setMetrics);
    detectRecurringIssues().then(setRecurring);
  }, [now]);

  const recentCases = useLiveQuery(() => db.cases.orderBy('createdAt').reverse().limit(6).toArray(), []) ?? EMPTY_ARR;
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? EMPTY_ARR;
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const totalCustomers = customers.length;

  if (!metrics) return null;

  if (metrics.totalCases === 0 && totalCustomers === 0) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          title="Your workspace is empty"
          description="Create your first customer and case, or load sample data from Settings to explore the full product."
          action={<Button onClick={() => navigate('/customers')}>Add a customer</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Inbox} label="Open cases" value={metrics.openCases} onClick={() => navigate('/cases')} />
        <StatCard icon={AlertTriangle} label="Critical cases" value={metrics.criticalCases} color="critical" onClick={() => navigate('/cases?priority=Critical')} />
        <StatCard icon={Clock} label="SLA at risk" value={metrics.slaAtRisk} color="warn" onClick={() => navigate('/cases?sla=At Risk')} />
        <StatCard icon={AlertTriangle} label="SLA breached" value={metrics.slaBreached} color="critical" onClick={() => navigate('/cases?sla=Breached')} />
        <StatCard icon={CheckCircle2} label="Resolved today" value={metrics.resolvedToday} color="success" />
        <StatCard icon={CheckCircle2} label="Resolution rate" value={metrics.resolutionRate != null ? `${metrics.resolutionRate}%` : '—'} color="success" />
        <StatCard icon={TrendingUp} label="Avg. resolution" value={metrics.avgResolutionMins != null ? `${Math.round(metrics.avgResolutionMins / 60)}h` : '—'} color="info" />
        <StatCard icon={Smile} label="Avg. satisfaction" value={metrics.avgSatisfaction != null ? `${metrics.avgSatisfaction}/5` : '—'} color="intel" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink dark:text-white">Recent activity</h2>
            <button onClick={() => navigate('/cases')} className="text-xs text-navy dark:text-info font-medium">View all</button>
          </div>
          {recentCases.length === 0 ? (
            <EmptyState icon={Inbox} title="No cases yet" description="New customer requests will show up here." />
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {recentCases.map((c) => (
                <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink dark:text-slate-100 truncate">#{c.id} · {c.subject}</p>
                    <p className="text-xs text-ink-faint truncate">{customerMap[c.customerId]?.name || 'Unknown customer'} · {timeAgo(c.createdAt)}</p>
                  </div>
                  <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
                  <Badge color={SLA_STATE_COLOR[c.slaState]}>{c.slaState}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-ink dark:text-white mb-4">Recurring issues</h2>
          {recurring.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Nothing recurring" description="No category has 3+ cases in the last 7 days." />
          ) : (
            <div className="space-y-3">
              {recurring.map((r) => (
                <div key={r.category} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-ink dark:text-slate-100">{r.category}</p>
                    <p className="text-xs text-ink-faint">{r.count} cases · last {r.windowDays}d</p>
                  </div>
                  {r.changePct != null && <Badge color={r.changePct >= 0 ? 'warn' : 'success'}>{r.changePct >= 0 ? '+' : ''}{r.changePct}%</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-display font-semibold text-ink dark:text-white mb-4">Department workload</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(metrics.byDepartment).map(([dept, count]) => (
            <div key={dept} className="rounded-lg bg-slate-50 dark:bg-white/5 p-3">
              <p className="text-xs text-ink-faint">{dept}</p>
              <p className="text-xl font-display font-semibold text-ink dark:text-white">{count}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
