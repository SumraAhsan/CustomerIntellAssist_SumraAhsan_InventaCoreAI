import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { db } from '../db/db';
import { Card } from '../components/ui/ui';
import { useApp } from '../context/useApp';
import { EMPTY_ARR } from '../lib/emptyArray';

const PIE_COLORS = ['#0B2559', '#2F80ED', '#F2994A', '#7C5CFC', '#1F9D55', '#DC2626', '#94A3B8'];

export default function Trends() {
  const { theme } = useApp();
  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;

  const byCategory = useMemo(() => {
    const map = {};
    for (const c of cases) map[c.category] = (map[c.category] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [cases]);

  const byPriority = useMemo(() => {
    const order = ['Critical', 'High', 'Medium', 'Low'];
    const map = {};
    for (const c of cases) map[c.priority] = (map[c.priority] || 0) + 1;
    return order.map((name) => ({ name, value: map[name] || 0 }));
  }, [cases]);

  const overTime = useMemo(() => {
    const days = 14;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1 - i));
      return { date: d, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), created: 0, resolved: 0 };
    });
    for (const c of cases) {
      const created = new Date(c.createdAt); created.setHours(0, 0, 0, 0);
      const bucket = buckets.find((b) => b.date.getTime() === created.getTime());
      if (bucket) bucket.created += 1;
      if (c.resolvedAt) {
        const resolved = new Date(c.resolvedAt); resolved.setHours(0, 0, 0, 0);
        const rb = buckets.find((b) => b.date.getTime() === resolved.getTime());
        if (rb) rb.resolved += 1;
      }
    }
    return buckets;
  }, [cases]);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display font-semibold text-ink dark:text-white mb-4">Cases over the last 14 days</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={overTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-black/5 dark:text-white/10" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#98A2B3" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#98A2B3" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="created" stroke="#0B2559" strokeWidth={2} dot={false} name="Created" />
              <Line type="monotone" dataKey="resolved" stroke="#1F9D55" strokeWidth={2} dot={false} name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-display font-semibold text-ink dark:text-white mb-4">Cases by category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name} (${value})`} stroke={theme === 'dark' ? '#101E3D' : '#FFFFFF'} strokeWidth={2}>
                  {byCategory.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-ink dark:text-white mb-4">Cases by priority</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-black/5 dark:text-white/10" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#98A2B3" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#98A2B3" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" fill="#F2994A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
