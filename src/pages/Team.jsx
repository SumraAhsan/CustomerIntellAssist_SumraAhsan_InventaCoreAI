import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Card, Badge } from '../components/ui/ui';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Team() {
  const agents = useLiveQuery(() => db.agents.toArray(), []) ?? EMPTY_ARR;
  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;

  const rows = useMemo(() => agents.map((a) => {
    const mine = cases.filter((c) => c.assignedAgentId === a.id);
    const open = mine.filter((c) => !['Resolved', 'Closed'].includes(c.status));
    const resolved = mine.filter((c) => c.resolutionMins != null);
    const avgResolution = resolved.length ? Math.round(resolved.reduce((s, c) => s + c.resolutionMins, 0) / resolved.length) : null;
    return {
      ...a,
      openCases: open.length,
      highPriority: open.filter((c) => ['High', 'Critical'].includes(c.priority)).length,
      slaAtRisk: open.filter((c) => c.slaState === 'At Risk').length,
      overdue: open.filter((c) => c.slaState === 'Breached').length,
      resolved: resolved.length,
      avgResolution,
    };
  }), [agents, cases]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-ink-faint uppercase tracking-wide border-b border-black/5 dark:border-white/10">
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Department</th>
              <th className="px-4 py-3 font-medium">Open</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">High priority</th>
              <th className="px-4 py-3 font-medium">SLA at risk</th>
              <th className="px-4 py-3 font-medium">Overdue</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Resolved</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Avg. resolution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                <td className="px-4 py-3"><p className="font-medium text-ink dark:text-slate-100">{r.name}</p><p className="text-xs text-ink-faint">{r.role}</p></td>
                <td className="px-4 py-3 hidden sm:table-cell text-ink-soft dark:text-slate-300">{r.department}</td>
                <td className="px-4 py-3">{r.openCases}</td>
                <td className="px-4 py-3 hidden md:table-cell">{r.highPriority}</td>
                <td className="px-4 py-3">{r.slaAtRisk > 0 ? <Badge color="warn">{r.slaAtRisk}</Badge> : 0}</td>
                <td className="px-4 py-3">{r.overdue > 0 ? <Badge color="critical">{r.overdue}</Badge> : 0}</td>
                <td className="px-4 py-3 hidden lg:table-cell">{r.resolved}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-ink-faint">{r.avgResolution != null ? `${Math.round(r.avgResolution / 60)}h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
