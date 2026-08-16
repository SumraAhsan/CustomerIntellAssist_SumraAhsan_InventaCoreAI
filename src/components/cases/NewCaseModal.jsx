import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { db } from '../../db/db';
import { Modal, Button, Field, Input, Textarea, Select, Badge } from '../ui/ui';
import { analyzeCase } from '../../lib/intelligence';
import { createCase, createCustomer } from '../../lib/repo';
import { PRIORITY_COLOR } from '../../lib/constants';
import { useApp } from '../../context/useApp';
import { EMPTY_ARR } from '../../lib/emptyArray';

export default function NewCaseModal({ open, onClose }) {
  const { profile } = useApp();
  const navigate = useNavigate();
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []) ?? EMPTY_ARR;
  const [step, setStep] = useState('input');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep('input'); setSubject(''); setDescription(''); setCustomerId('');
    setNewCustomerName(''); setNewCustomerEmail(''); setCreatingNew(false);
    setAnalysis(null); setErrors({});
  }
  function close() { reset(); onClose(); }

  function validate() {
    const e = {};
    if (!subject.trim()) e.subject = 'Subject is required.';
    if (!description.trim() || description.trim().length < 8) e.description = 'Please describe the issue in at least a few words.';
    if (creatingNew) {
      if (!newCustomerName.trim()) e.newCustomerName = 'Customer name is required.';
      if (!newCustomerEmail.trim() || !/^\S+@\S+\.\S+$/.test(newCustomerEmail)) e.newCustomerEmail = 'A valid email is required.';
    } else if (!customerId) e.customerId = 'Select an existing customer or create a new one.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function runAnalysis() {
    if (!validate()) return;
    setBusy(true);
    try {
      const existingCases = await db.cases.toArray();
      const result = analyzeCase(subject, description, existingCases, customerId || 'new');
      setAnalysis(result);
      setStep('analyzed');
    } finally { setBusy(false); }
  }

  async function confirmCreate() {
    setBusy(true);
    try {
      let cid = customerId;
      if (creatingNew) cid = await createCustomer({ name: newCustomerName, email: newCustomerEmail }, profile?.name || 'Agent');
      const caseId = await createCase({ subject, description, customerId: cid, actor: profile?.name || 'Agent' });
      close();
      navigate(`/cases/${caseId}`);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={close} title="New case" wide
      footer={step === 'input' ? (
        <><Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={runAnalysis} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Analyze</Button></>
      ) : (
        <><Button variant="outline" onClick={() => setStep('input')}>Back</Button>
          <Button onClick={confirmCreate} disabled={busy}>{busy ? 'Creating…' : 'Create case'}</Button></>
      )}
    >
      {step === 'input' && (
        <div className="space-y-4">
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setCreatingNew(false)} className={`px-3 py-1.5 rounded-lg ${!creatingNew ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-white/10 text-ink-soft dark:text-slate-300'}`}>Existing customer</button>
            <button type="button" onClick={() => setCreatingNew(true)} className={`px-3 py-1.5 rounded-lg ${creatingNew ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-white/10 text-ink-soft dark:text-slate-300'}`}>New customer</button>
          </div>
          {!creatingNew ? (
            <Field label="Customer" error={errors.customerId}>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
              </Select>
            </Field>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" error={errors.newCustomerName}><Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name" /></Field>
              <Field label="Email" error={errors.newCustomerEmail}><Input value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} placeholder="customer@example.com" /></Field>
            </div>
          )}
          <Field label="Subject" error={errors.subject}><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the issue" /></Field>
          <Field label="Description" error={errors.description} hint="The more detail provided, the more accurate the automated analysis will be.">
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the customer's issue in their own words…" />
          </Field>
          {errors.submit && <p className="text-sm text-critical">{errors.submit}</p>}
        </div>
      )}

      {step === 'analyzed' && analysis && (
        <div className="space-y-4">
          <div className="rounded-lg bg-intel-soft dark:bg-intel/10 p-3 flex items-start gap-2">
            <Sparkles size={16} className="text-intel mt-0.5 shrink-0" />
            <p className="text-xs text-intel dark:text-violet-300">Automated suggestion from the built-in intelligence engine — reviewed by you before the case is created. All fields are editable afterward.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnalysisTile label="Category" value={analysis.category.category} confidence={analysis.category.confidence} />
            <AnalysisTile label="Priority" value={analysis.priority.priority} confidence={analysis.priority.confidence} badgeColor={PRIORITY_COLOR[analysis.priority.priority]} />
            <AnalysisTile label="Sentiment" value={analysis.sentiment.sentiment} confidence={analysis.sentiment.confidence} />
            <AnalysisTile label="Department" value={analysis.department} />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-ink dark:text-slate-200">Reasoning</p>
            <ul className="list-disc list-inside text-ink-soft dark:text-slate-400 space-y-0.5">
              {[...analysis.category.reasons, ...analysis.priority.reasons, ...analysis.sentiment.reasons].map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          {analysis.missingInfo.length > 0 && (
            <div>
              <p className="font-medium text-sm text-ink dark:text-slate-200 mb-1">Missing information detected</p>
              <div className="flex flex-wrap gap-1.5">{analysis.missingInfo.map((m) => <Badge key={m} color="warn">{m}</Badge>)}</div>
            </div>
          )}
          {analysis.related.length > 0 && (
            <div>
              <p className="font-medium text-sm text-ink dark:text-slate-200 mb-1">Possibly related cases</p>
              <div className="space-y-1.5">
                {analysis.related.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-ink-soft dark:text-slate-300 truncate">#{r.id} · {r.subject}</span>
                    <span className="text-xs text-ink-faint shrink-0 ml-2">{r.reasons.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AnalysisTile({ label, value, confidence, badgeColor }) {
  return (
    <div className="rounded-lg border border-black/5 dark:border-white/10 p-3">
      <p className="text-[11px] text-ink-faint mb-1">{label}</p>
      <p className={`text-sm font-semibold capitalize ${badgeColor ? '' : 'text-ink dark:text-slate-100'}`}>{value}</p>
      {confidence != null && <p className={`text-[11px] mt-0.5 ${confidence < 0.6 ? 'text-warn' : 'text-ink-faint'}`}>{Math.round(confidence * 100)}% confidence{confidence < 0.6 ? ' — please review' : ''}</p>}
    </div>
  );
}
