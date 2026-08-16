import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, FileBarChart } from 'lucide-react';
import { db } from '../db/db';
import { computeDashboardMetrics, detectRecurringIssues } from '../lib/repo';
import { Card, Button } from '../components/ui/ui';
import { toCsv, downloadFile } from '../lib/format';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Reports() {
  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? EMPTY_ARR;
  const auditEvents = useLiveQuery(() => db.auditEvents.toArray(), []) ?? EMPTY_ARR;
  const [metrics, setMetrics] = useState(null);
  const [recurring, setRecurring] = useState([]);

  useEffect(() => { computeDashboardMetrics().then(setMetrics); detectRecurringIssues().then(setRecurring); }, [cases.length]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  function exportCases() {
    const csv = toCsv(cases, [
      { label: 'ID', value: (c) => c.id }, { label: 'Subject', value: (c) => c.subject },
      { label: 'Customer', value: (c) => customerMap[c.customerId]?.name || '' },
      { label: 'Category', value: (c) => c.category }, { label: 'Priority', value: (c) => c.priority },
      { label: 'Status', value: (c) => c.status }, { label: 'SLA State', value: (c) => c.slaState },
      { label: 'Department', value: (c) => c.department }, { label: 'Created', value: (c) => c.createdAt },
      { label: 'Resolved', value: (c) => c.resolvedAt || '' }, { label: 'Resolution (mins)', value: (c) => c.resolutionMins ?? '' },
    ]);
    downloadFile('cases.csv', csv, 'text/csv');
  }

  function exportCustomers() {
    const csv = toCsv(customers, [
      { label: 'ID', value: (c) => c.id }, { label: 'Name', value: (c) => c.name }, { label: 'Email', value: (c) => c.email },
      { label: 'Status', value: (c) => c.accountStatus }, { label: 'Created', value: (c) => c.createdAt },
      { label: 'Satisfaction', value: (c) => c.satisfaction ?? '' },
    ]);
    downloadFile('customers.csv', csv, 'text/csv');
  }

  function exportAuditLog() {
    const csv = toCsv(auditEvents, [
      { label: 'Timestamp', value: (e) => e.timestamp }, { label: 'Actor', value: (e) => e.actor },
      { label: 'Action', value: (e) => e.action }, { label: 'Target type', value: (e) => e.targetType },
      { label: 'Target ID', value: (e) => e.targetId }, { label: 'Details', value: (e) => e.details || '' },
    ]);
    downloadFile('audit-log.csv', csv, 'text/csv');
  }

  const reportRows = useMemo(() => {
    if (!metrics) return [];
    return [
      ['Total cases', metrics.totalCases], ['Open cases', metrics.openCases], ['Critical cases', metrics.criticalCases],
      ['SLA at risk', metrics.slaAtRisk], ['SLA breached', metrics.slaBreached], ['Resolved today', metrics.resolvedToday],
      ['Resolution rate', metrics.resolutionRate != null ? `${metrics.resolutionRate}%` : '—'],
      ['Average resolution (mins, calculated from current data)', metrics.avgResolutionMins ?? '—'],
      ['Average satisfaction (calculated from current data)', metrics.avgSatisfaction ?? '—'],
    ];
  }, [metrics]);

  function exportSummary() {
    const csv = toCsv(reportRows.map(([label, value]) => ({ label, value })), [{ label: 'Metric', value: (r) => r.label }, { label: 'Value', value: (r) => r.value }]);
    downloadFile('summary-report.csv', csv, 'text/csv');
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="flex flex-col gap-2">
          <h3 className="font-display font-semibold text-ink dark:text-white">Cases export</h3>
          <p className="text-xs text-ink-faint">All case records with status, priority, SLA outcome.</p>
          <Button size="sm" variant="outline" onClick={exportCases} className="mt-auto"><Download size={14} /> Export CSV</Button>
        </Card>
        <Card className="flex flex-col gap-2">
          <h3 className="font-display font-semibold text-ink dark:text-white">Customers export</h3>
          <p className="text-xs text-ink-faint">Customer roster with account status and satisfaction.</p>
          <Button size="sm" variant="outline" onClick={exportCustomers} className="mt-auto"><Download size={14} /> Export CSV</Button>
        </Card>
        <Card className="flex flex-col gap-2">
          <h3 className="font-display font-semibold text-ink dark:text-white">Audit log export</h3>
          <p className="text-xs text-ink-faint">Full history of recorded actions.</p>
          <Button size="sm" variant="outline" onClick={exportAuditLog} className="mt-auto"><Download size={14} /> Export CSV</Button>
        </Card>
        <Card className="flex flex-col gap-2">
          <h3 className="font-display font-semibold text-ink dark:text-white">Summary report</h3>
          <p className="text-xs text-ink-faint">Key metrics calculated live from current data.</p>
          <Button size="sm" variant="outline" onClick={exportSummary} className="mt-auto"><Download size={14} /> Export CSV</Button>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3"><FileBarChart size={18} className="text-navy dark:text-info" /><h2 className="font-display font-semibold text-ink dark:text-white">Service report (calculated from current data)</h2></div>
        <table className="w-full text-sm">
          <tbody>
            {reportRows.map(([label, value]) => (
              <tr key={label} className="border-b border-black/5 dark:border-white/5 last:border-0">
                <td className="py-2 text-ink-soft dark:text-slate-400">{label}</td>
                <td className="py-2 text-right font-medium text-ink dark:text-slate-100">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {recurring.length > 0 && (
        <Card>
          <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Recurring issues report</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-ink-faint uppercase border-b border-black/5 dark:border-white/10"><th className="py-2">Category</th><th className="py-2">Count (7d)</th><th className="py-2">Change vs prior period</th></tr></thead>
            <tbody>
              {recurring.map((r) => (
                <tr key={r.category} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 text-ink dark:text-slate-200">{r.category}</td><td className="py-2">{r.count}</td>
                  <td className="py-2">{r.changePct != null ? `${r.changePct >= 0 ? '+' : ''}${r.changePct}%` : 'n/a (no prior-period data)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
