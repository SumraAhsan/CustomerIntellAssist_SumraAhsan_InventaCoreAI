import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Sparkles, AlertTriangle, Link2, BookOpen, MessageSquare, StickyNote } from 'lucide-react';
import { db } from '../db/db';
import { updateCaseStatus, overridePriority, reassignCase, addCaseNote, addCaseMessage, linkRelatedCase } from '../lib/repo';
import { Card, Badge, Button, Select, Textarea, EmptyState } from '../components/ui/ui';
import { PRIORITIES, STATUS_TRANSITIONS, PRIORITY_COLOR, SLA_STATE_COLOR } from '../lib/constants';
import { formatRemaining, computeSlaState } from '../lib/sla';
import { formatDate, timeAgo } from '../lib/format';
import { useApp } from '../context/useApp';
import ResponseAssistant from '../components/cases/ResponseAssistant';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function CaseDetail() {
  const { id } = useParams();
  const caseId = Number(id);
  const validId = Number.isInteger(caseId);
  const navigate = useNavigate();
  const { profile, now } = useApp();
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');

  const c = useLiveQuery(() => (validId ? db.cases.get(caseId) : null), [caseId, validId]);
  const customer = useLiveQuery(() => (c ? db.customers.get(c.customerId) : null), [c?.customerId]);
  const agents = useLiveQuery(() => db.agents.toArray(), []) ?? EMPTY_ARR;
  const auditEvents = useLiveQuery(async () => {
    if (!validId) return [];
    const events = await db.auditEvents.where('targetId').equals(caseId).and((e) => e.targetType === 'case').sortBy('timestamp');
    return events.reverse();
  }, [caseId, validId]) ?? EMPTY_ARR;
  const knowledge = useLiveQuery(() => (c ? db.knowledgeArticles.where('category').equals(c.category).toArray() : []), [c?.category]) ?? EMPTY_ARR;
  const relatedCases = useLiveQuery(() => (c?.relatedCaseIds?.length ? db.cases.bulkGet(c.relatedCaseIds) : []), [c?.relatedCaseIds]) ?? EMPTY_ARR;

  if (c === undefined) return null;
  if (!c) {
    return <EmptyState icon={AlertTriangle} title="Case not found" description="This case may have been removed." action={<Button onClick={() => navigate('/cases')}>Back to cases</Button>} />;
  }

  const actor = profile?.name || 'Agent';
  const canEdit = profile?.role && profile.role !== 'Viewer';
  const allowedTransitions = STATUS_TRANSITIONS[c.status] || [];
  const slaState = computeSlaState(c.slaResolutionDeadline, { now, createdAt: c.createdAt, resolved: !!c.resolvedAt });
  const assignedAgent = agents.find((a) => a.id === c.assignedAgentId);
  const suggestedRelated = (c.analysis?.related || []).filter((r) => !(c.relatedCaseIds || []).includes(r.id));

  async function handleStatusChange(status) {
    setError('');
    try { await updateCaseStatus(caseId, status, actor); } catch (e) { setError(e.message); }
  }
  async function handlePriorityChange(p) { if (p !== c.priority) await overridePriority(caseId, p, actor); }
  async function handleReassign(agentId) { if (agentId) await reassignCase(caseId, Number(agentId), actor); }
  async function handleLinkRelated(relatedId) { await linkRelatedCase(caseId, relatedId, actor); }
  async function submitNote() { if (!noteText.trim()) return; await addCaseNote(caseId, noteText.trim(), actor); setNoteText(''); }
  async function insertResponse(body) { await addCaseMessage(caseId, { direction: 'outbound', body, status: 'sent' }, actor); }

  const timeline = [
    ...(c.messages || []).map((m) => ({ ...m, kind: 'message' })),
    ...(c.notes || []).map((n) => ({ ...n, kind: 'note', at: n.at, body: n.text })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/cases')} className="flex items-center gap-1 text-sm text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-white">
        <ArrowLeft size={15} /> Back to cases
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink dark:text-white">#{c.id} · {c.subject}</h1>
          <p className="text-sm text-ink-faint mt-0.5">Created {formatDate(c.createdAt)} · {customer ? <Link to={`/customers/${customer.id}`} className="underline decoration-dotted">{customer.name}</Link> : 'Unknown customer'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
          <Badge color={SLA_STATE_COLOR[slaState]}>{slaState}</Badge>
        </div>
      </div>

      {error && <div className="rounded-lg bg-critical-soft text-critical text-sm px-3 py-2">{error}</div>}
      {!canEdit && <div className="rounded-lg bg-info-soft text-info text-sm px-3 py-2">Viewer access — you can read this case but cannot make changes.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h2 className="font-display font-semibold text-ink dark:text-white mb-2">Description</h2>
            <p className="text-sm text-ink-soft dark:text-slate-300 whitespace-pre-wrap">{c.description}</p>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3"><Sparkles size={16} className="text-intel" /><h2 className="font-display font-semibold text-ink dark:text-white">Intelligent analysis</h2></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <MiniStat label="Category" value={c.analysis?.category?.category} confidence={c.analysis?.category?.confidence} />
              <MiniStat label="Sentiment" value={c.sentiment} confidence={c.analysis?.sentiment?.confidence} />
              <MiniStat label="Suggested priority" value={c.analysis?.priority?.priority} confidence={c.analysis?.priority?.confidence} />
              <MiniStat label="Department" value={c.department} />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-soft dark:text-slate-400 font-medium">Why this classification?</summary>
              <ul className="list-disc list-inside mt-2 text-ink-soft dark:text-slate-400 space-y-0.5">
                {[...(c.analysis?.category?.reasons || []), ...(c.analysis?.priority?.reasons || []), ...(c.analysis?.sentiment?.reasons || [])].map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </details>
            {c.missingInfo?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
                <p className="text-sm font-medium text-ink dark:text-slate-200 mb-1.5">Missing information</p>
                <div className="flex flex-wrap gap-1.5">{c.missingInfo.map((m) => <Badge key={m} color="warn">{m}</Badge>)}</div>
              </div>
            )}
          </Card>

          {(relatedCases.filter(Boolean).length > 0 || suggestedRelated.length > 0) && (
            <Card>
              <div className="flex items-center gap-2 mb-3"><Link2 size={16} className="text-navy dark:text-info" /><h2 className="font-display font-semibold text-ink dark:text-white">Related cases</h2></div>
              <div className="space-y-1.5">
                {relatedCases.filter(Boolean).map((r) => (
                  <Link key={r.id} to={`/cases/${r.id}`} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10">
                    <span className="text-ink-soft dark:text-slate-300 truncate">#{r.id} · {r.subject}</span>
                    <Badge color={PRIORITY_COLOR[r.priority]}>{r.priority}</Badge>
                  </Link>
                ))}
                {suggestedRelated.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-warn-soft dark:bg-warn/10 rounded-lg px-3 py-2 gap-2">
                    <div className="min-w-0">
                      <Link to={`/cases/${r.id}`} className="text-ink dark:text-slate-200 truncate block hover:underline">#{r.id} · {r.subject}</Link>
                      <span className="text-xs text-ink-faint">{r.reasons.join(', ')} — possible match</span>
                    </div>
                    {canEdit && <Button size="sm" variant="outline" onClick={() => handleLinkRelated(r.id)} className="shrink-0">Link</Button>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-2 mb-3"><MessageSquare size={16} className="text-navy dark:text-info" /><h2 className="font-display font-semibold text-ink dark:text-white">Response assistant</h2></div>
            {canEdit ? (
              <ResponseAssistant caseItem={c} customerName={customer?.name || 'Customer'} onInsert={insertResponse} />
            ) : <p className="text-sm text-ink-faint">Viewer access — response drafting is limited to Agents and above.</p>}
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Activity</h2>
            {timeline.length === 0 ? <p className="text-sm text-ink-faint">No messages or notes yet.</p> : (
              <div className="space-y-3">
                {timeline.map((item) => (
                  <div key={item.id} className={`rounded-lg p-3 text-sm ${item.kind === 'note' ? 'bg-intel-soft dark:bg-intel/10' : item.direction === 'outbound' ? 'bg-info-soft dark:bg-info/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-soft dark:text-slate-300">
                        {item.kind === 'note' ? <><StickyNote size={12} className="inline mr-1" />Internal note</> : item.direction === 'outbound' ? 'Sent to customer' : 'Customer message'} · {item.author}
                      </span>
                      <span className="text-xs text-ink-faint">{timeAgo(item.at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-ink dark:text-slate-200">{item.body}</p>
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <Textarea rows={2} placeholder="Add an internal note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <Button size="sm" onClick={submitNote} className="self-end">Add</Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Case controls</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-ink-faint mb-1">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {allowedTransitions.length === 0 && <span className="text-ink-faint text-xs">No further transitions ({c.status}).</span>}
                  {canEdit && allowedTransitions.map((s) => (
                    <button key={s} onClick={() => handleStatusChange(s)} className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-navy hover:text-white dark:hover:bg-navy transition-colors">→ {s}</button>
                  ))}
                </div>
                <p className="text-xs text-ink-faint mt-1">Current: <span className="font-medium text-ink dark:text-slate-200">{c.status}</span></p>
              </div>
              <div>
                <label className="block text-xs text-ink-faint mb-1">Priority (override)</label>
                <Select value={c.priority} disabled={!canEdit} onChange={(e) => handlePriorityChange(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-ink-faint mb-1">Assigned agent {assignedAgent && <span className="text-ink dark:text-slate-300 font-medium">— {assignedAgent.name}</span>}</label>
                <Select value={c.assignedAgentId || ''} disabled={!canEdit} onChange={(e) => handleReassign(e.target.value)}>
                  <option value="">Unassigned</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.department}</option>)}
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-ink dark:text-white mb-3">SLA</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-faint">First response</span><span className="text-ink dark:text-slate-200">{formatRemaining(c.slaFirstResponseDeadline, now)}</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">Resolution</span><span className="text-ink dark:text-slate-200">{c.resolvedAt ? 'Resolved' : formatRemaining(c.slaResolutionDeadline, now)}</span></div>
              <Badge color={SLA_STATE_COLOR[slaState]} className="mt-1">{slaState}</Badge>
            </div>
          </Card>

          {knowledge.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3"><BookOpen size={16} className="text-navy dark:text-info" /><h2 className="font-display font-semibold text-ink dark:text-white">Recommended knowledge</h2></div>
              <div className="space-y-2">
                {knowledge.slice(0, 3).map((k) => (
                  <div key={k.id} className="text-sm"><p className="font-medium text-ink dark:text-slate-200">{k.title}</p><p className="text-xs text-ink-faint line-clamp-2">{k.content}</p></div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Audit trail</h2>
            {auditEvents.length === 0 ? <p className="text-sm text-ink-faint">No audit events yet.</p> : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                {auditEvents.map((e) => (
                  <div key={e.id} className="text-xs">
                    <p className="text-ink dark:text-slate-300">{e.actor} {e.action}{e.details ? ` — ${e.details}` : ''}</p>
                    <p className="text-ink-faint">{formatDate(e.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, confidence }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 p-2.5">
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="text-sm font-semibold text-ink dark:text-slate-100 capitalize break-words">{value || '—'}</p>
      {confidence != null && <p className="text-[10px] text-ink-faint">{Math.round(confidence * 100)}% confidence</p>}
    </div>
  );
}
