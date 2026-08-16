import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { db } from '../db/db';
import { detectRecurringIssues } from '../lib/repo';
import { Card, Badge, EmptyState } from '../components/ui/ui';
import { PRIORITY_COLOR } from '../lib/constants';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Insights() {
  const [recurring, setRecurring] = useState([]);
  useEffect(() => { detectRecurringIssues().then(setRecurring); }, []);

  const lowConfidenceCases = useLiveQuery(
    () => db.cases.filter((c) => (c.analysis?.category?.confidence ?? 1) < 0.6 && !['Resolved', 'Closed'].includes(c.status)).toArray(),
    []
  ) ?? EMPTY_ARR;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-2"><Sparkles size={18} className="text-intel" /><h2 className="font-display font-semibold text-ink dark:text-white">How the built-in intelligence engine works</h2></div>
        <p className="text-sm text-ink-soft dark:text-slate-400">
          Every case is analyzed locally with a deterministic rule-based engine — keyword matching for category,
          a sentiment lexicon, a weighted priority score, and text-overlap similarity for duplicate detection.
          It runs entirely in your browser, and every suggestion is shown with its reasoning and can be
          overridden by an agent.
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3"><TrendingUp size={18} className="text-navy dark:text-info" /><h2 className="font-display font-semibold text-ink dark:text-white">Recurring issues</h2></div>
        {recurring.length === 0 ? (
          <EmptyState title="Nothing recurring right now" description="No category has 3 or more cases in the last 7 days." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recurring.map((r) => (
              <div key={r.category} className="rounded-lg bg-slate-50 dark:bg-white/5 p-3">
                <p className="font-medium text-ink dark:text-slate-100">{r.category}</p>
                <p className="text-xs text-ink-faint mb-1">{r.count} cases in the last {r.windowDays} days</p>
                {r.changePct != null && <Badge color={r.changePct >= 0 ? 'warn' : 'success'}>{r.changePct >= 0 ? '+' : ''}{r.changePct}% vs previous period</Badge>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3"><AlertCircle size={18} className="text-warn" /><h2 className="font-display font-semibold text-ink dark:text-white">Low-confidence classifications</h2></div>
        {lowConfidenceCases.length === 0 ? (
          <EmptyState title="Nothing needs review" description="All open cases were classified with reasonable confidence." />
        ) : (
          <div className="space-y-2">
            {lowConfidenceCases.map((c) => (
              <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center justify-between text-sm bg-warn-soft dark:bg-warn/10 rounded-lg px-3 py-2 hover:brightness-95">
                <span className="text-ink dark:text-slate-200 truncate">#{c.id} · {c.subject}</span>
                <span className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
                  <span className="text-xs text-warn">{Math.round((c.analysis?.category?.confidence ?? 0) * 100)}%</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
