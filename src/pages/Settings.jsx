import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, RotateCcw, Save, Sun, Moon, Sparkles, Trash2, FileUp, FileDown } from 'lucide-react';
import { db, getSetting, setSetting } from '../db/db';
import { exportBackup, restoreBackup, validateBackup, importCasesFromCsv, logAudit } from '../lib/repo';
import { loadSampleData, clearSampleData, hasAnyData, hasSampleData } from '../lib/seed';
import { DEFAULT_SLA_CONFIG, PRIORITIES, ROLES } from '../lib/constants';
import { isValidSlaConfig } from '../lib/sla';
import { parseCsv, validateCaseImportRows, csvImportTemplate } from '../lib/csv';
import { downloadFile, toCsv } from '../lib/format';
import { Card, Button, Field, Input, Select, Modal, ConfirmDialog } from '../components/ui/ui';
import { useApp } from '../context/useApp';
import { EMPTY_ARR } from '../lib/emptyArray';

export default function Settings() {
  const { profile, updateProfile, resetWorkspace, theme, setTheme } = useApp();
  const [name, setName] = useState(profile?.name || '');
  const [workspaceName, setWorkspaceName] = useState(profile?.workspaceName || '');
  const [role, setRole] = useState(profile?.role || 'Administrator');
  const [slaConfig, setSlaConfig] = useState(DEFAULT_SLA_CONFIG);
  const [savedMsg, setSavedMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearSample, setConfirmClearSample] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [sampleBusy, setSampleBusy] = useState(false);
  const fileRef = useRef(null);
  const importFileRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null); // { valid, invalid, total }
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null); // { created, failed }

  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? EMPTY_ARR;
  const cases = useLiveQuery(() => db.cases.toArray(), []) ?? EMPTY_ARR;
  const auditEvents = useLiveQuery(() => db.auditEvents.toArray(), []) ?? EMPTY_ARR;
  const [orgHasData, setOrgHasData] = useState(true);
  const [orgHasSampleData, setOrgHasSampleData] = useState(false);

  useEffect(() => { getSetting('slaConfig', DEFAULT_SLA_CONFIG).then(setSlaConfig); }, []);
  useEffect(() => { hasAnyData().then(setOrgHasData); hasSampleData().then(setOrgHasSampleData); }, [customers.length]);
  useEffect(() => { if (profile) { setName(profile.name); setWorkspaceName(profile.workspaceName); setRole(profile.role); } }, [profile]);

  function flash(msg) { setSavedMsg(msg); setTimeout(() => setSavedMsg(''), 4000); }

  async function saveProfile() {
    await updateProfile({ name, workspaceName, role });
    await logAudit(name, 'updated workspace profile', 'workspace', 0);
    flash('Workspace profile saved.');
  }

  async function saveSla() {
    if (!isValidSlaConfig(slaConfig, PRIORITIES)) {
      flash('SLA rules were not saved — every field must be a whole number of at least 1 minute.');
      return;
    }
    await setSetting('slaConfig', slaConfig);
    await logAudit(profile?.name || 'Admin', 'updated SLA configuration', 'workspace', 0);
    flash('SLA configuration saved.');
  }

  async function handleExportBackup() {
    const backup = await exportBackup();
    downloadFile(`customer-intellassist-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
    await logAudit(profile?.name || 'Admin', 'exported workspace backup', 'workspace', 0);
  }

  function exportCasesCsv() {
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const csv = toCsv(cases, [
      { label: 'ID', value: (c) => c.id }, { label: 'Subject', value: (c) => c.subject },
      { label: 'Customer', value: (c) => customerMap[c.customerId]?.name || '' },
      { label: 'Status', value: (c) => c.status }, { label: 'Priority', value: (c) => c.priority },
    ]);
    downloadFile('cases.csv', csv, 'text/csv');
  }
  function exportCustomersCsv() {
    const csv = toCsv(customers, [
      { label: 'ID', value: (c) => c.id }, { label: 'Name', value: (c) => c.name }, { label: 'Email', value: (c) => c.email },
    ]);
    downloadFile('customers.csv', csv, 'text/csv');
  }
  function exportAuditCsv() {
    const csv = toCsv(auditEvents, [
      { label: 'Timestamp', value: (e) => e.timestamp }, { label: 'Actor', value: (e) => e.actor }, { label: 'Action', value: (e) => e.action },
    ]);
    downloadFile('audit-log.csv', csv, 'text/csv');
  }

  function onFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingRestoreFile(file);
    setRestoreError('');
    setConfirmRestore(true);
  }

  async function doRestore() {
    if (!pendingRestoreFile) return;
    try {
      const text = await pendingRestoreFile.text();
      const backup = JSON.parse(text);
      const validationError = validateBackup(backup);
      if (validationError) { setRestoreError(validationError); return; }
      await restoreBackup(backup, { mode: 'replace' });
      setConfirmRestore(false);
      flash('Backup restored. Reloading…');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setRestoreError(`This file could not be read as a valid backup: ${err.message}`);
    } finally {
      setPendingRestoreFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function doLoadSample() {
    if (sampleBusy) return;
    setSampleBusy(true);
    try {
      await loadSampleData(profile?.name);
      flash('Sample data loaded — 38 customers, 72 cases, and 7 knowledge articles are ready to explore.');
    } catch (err) {
      flash(err.message);
    } finally {
      setSampleBusy(false);
    }
  }

  async function doClearSample() {
    setConfirmClearSample(false);
    await clearSampleData(profile?.name);
    flash('Sample data cleared.');
  }

  async function doResetWorkspace() {
    setConfirmReset(false);
    await resetWorkspace();
  }

  function downloadImportTemplate() {
    downloadFile('customer-intellassist-case-import-template.csv', csvImportTemplate(), 'text/csv');
  }

  async function onImportFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { rows } = parseCsv(text);
    if (rows.length === 0) {
      flash('That file has no data rows to import — check it against the template.');
      if (importFileRef.current) importFileRef.current.value = '';
      return;
    }
    const { valid, invalid } = validateCaseImportRows(rows);
    setImportPreview({ valid, invalid, total: rows.length });
    setImportResult(null);
  }

  function closeImportPreview() {
    setImportPreview(null);
    if (importFileRef.current) importFileRef.current.value = '';
  }

  async function confirmImport() {
    if (!importPreview || importPreview.valid.length === 0 || importBusy) return;
    setImportBusy(true);
    try {
      const result = await importCasesFromCsv(importPreview.valid, profile?.name || 'Workspace');
      setImportResult(result);
      setImportPreview(null);
    } finally {
      setImportBusy(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {savedMsg && <div className="rounded-lg bg-success-soft text-success text-sm px-3 py-2">{savedMsg}</div>}

      <Card>
        <h2 className="font-display font-semibold text-ink dark:text-white mb-3">Workspace profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Field label="Your name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Workspace name"><Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} /></Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
          </Field>
        </div>
        <Button onClick={saveProfile}><Save size={14} /> Save</Button>
      </Card>

      <Card>
        <h2 className="font-display font-semibold text-ink dark:text-white mb-1">Appearance</h2>
        <p className="text-xs text-ink-faint mb-3">Light mode is the default. Your choice is remembered on this device.</p>
        <div className="flex gap-2">
          <button onClick={() => setTheme('light')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${theme === 'light' ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-white/10 text-ink-soft dark:text-slate-300'}`}><Sun size={15} /> Light</button>
          <button onClick={() => setTheme('dark')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-white/10 text-ink-soft dark:text-slate-300'}`}><Moon size={15} /> Dark</button>
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-semibold text-ink dark:text-white mb-1">SLA rules</h2>
        <p className="text-xs text-ink-faint mb-3">Sample, editable targets — not an industry standard. Changes apply to newly created cases.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-ink-faint uppercase border-b border-black/5 dark:border-white/10"><th className="py-2">Priority</th><th className="py-2">First response (mins)</th><th className="py-2">Resolution (mins)</th></tr></thead>
            <tbody>
              {PRIORITIES.map((p) => (
                <tr key={p} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 font-medium text-ink dark:text-slate-200">{p}</td>
                  <td className="py-2 pr-3"><Input type="number" min="1" value={slaConfig[p]?.firstResponseMins ?? ''} className="w-28" onChange={(e) => setSlaConfig({ ...slaConfig, [p]: { ...slaConfig[p], firstResponseMins: Number(e.target.value) } })} /></td>
                  <td className="py-2"><Input type="number" min="1" value={slaConfig[p]?.resolutionMins ?? ''} className="w-28" onChange={(e) => setSlaConfig({ ...slaConfig, [p]: { ...slaConfig[p], resolutionMins: Number(e.target.value) } })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={saveSla} className="mt-3"><Save size={14} /> Save SLA rules</Button>
      </Card>

      <Card>
        <h2 className="font-display font-semibold text-ink dark:text-white mb-1">Data management</h2>
        <p className="text-xs text-ink-faint mb-3">Everything lives in this browser's IndexedDB. Back it up before clearing site data.</p>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-ink-soft dark:text-slate-300 mb-1.5">Backup</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportBackup}><Download size={14} /> Export full backup (JSON)</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={14} /> Restore from backup</Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFilePicked} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-soft dark:text-slate-300 mb-1.5">Quick exports</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportCasesCsv}><Download size={13} /> Cases CSV</Button>
              <Button size="sm" variant="outline" onClick={exportCustomersCsv}><Download size={13} /> Customers CSV</Button>
              <Button size="sm" variant="outline" onClick={exportAuditCsv}><Download size={13} /> Audit log CSV</Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-soft dark:text-slate-300 mb-1.5">Import cases from CSV</p>
            <p className="text-xs text-ink-faint mb-1.5">Each row is analyzed and processed exactly like a manually created case — classified, prioritized, routed, and assigned automatically.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadImportTemplate}><FileDown size={13} /> Download CSV template</Button>
              <Button size="sm" variant="outline" onClick={() => importFileRef.current?.click()}><FileUp size={13} /> Choose CSV file</Button>
              <input ref={importFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImportFilePicked} />
            </div>
            {importResult && (
              <div className="mt-2 rounded-lg bg-slate-50 dark:bg-white/5 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-ink dark:text-slate-200 font-medium">
                    {importResult.created.length} case{importResult.created.length === 1 ? '' : 's'} imported
                    {importResult.failed.length > 0 && `, ${importResult.failed.length} failed`}
                  </p>
                  <button onClick={() => setImportResult(null)} className="text-ink-faint hover:text-ink dark:hover:text-white">Dismiss</button>
                </div>
                {importResult.failed.length > 0 && (
                  <ul className="text-ink-faint space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin">
                    {importResult.failed.map((f) => <li key={f.rowNumber}>Row {f.rowNumber}: {f.reason}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-ink-soft dark:text-slate-300 mb-1.5">Sample data</p>
            <div className="flex flex-wrap gap-2">
              {!orgHasData && (
                <Button variant="outline" onClick={doLoadSample} disabled={sampleBusy}>
                  <Sparkles size={14} /> {sampleBusy ? 'Loading sample data…' : 'Load sample data'}
                </Button>
              )}
              {orgHasSampleData && (
                <Button variant="outline" onClick={() => setConfirmClearSample(true)}><Trash2 size={14} /> Clear sample data</Button>
              )}
            </div>
            {orgHasData && !orgHasSampleData && <p className="text-xs text-ink-faint mt-1">Sample data can only be loaded into an empty workspace — this one already has real data.</p>}
          </div>

          <div>
            <p className="text-xs font-medium text-ink-soft dark:text-slate-300 mb-1.5">Danger zone</p>
            <Button variant="danger" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Reset workspace</Button>
          </div>
        </div>
      </Card>

      <Modal
        open={Boolean(importPreview)} onClose={closeImportPreview} title="Import cases from CSV" wide
        footer={(
          <>
            <Button variant="outline" onClick={closeImportPreview}>Cancel</Button>
            <Button onClick={confirmImport} disabled={!importPreview?.valid.length || importBusy}>
              {importBusy ? 'Importing…' : `Import ${importPreview?.valid.length || 0} valid case${importPreview?.valid.length === 1 ? '' : 's'}`}
            </Button>
          </>
        )}
      >
        {importPreview && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft dark:text-slate-300">
              {importPreview.total} record{importPreview.total === 1 ? '' : 's'} found —{' '}
              <span className="text-success font-medium">{importPreview.valid.length} valid</span>
              {importPreview.invalid.length > 0 && (
                <> · <span className="text-warn font-medium">{importPreview.invalid.length} need correction</span></>
              )}
            </p>
            {importPreview.invalid.length > 0 && (
              <div className="rounded-lg bg-warn-soft dark:bg-warn/10 p-3 max-h-56 overflow-y-auto scrollbar-thin">
                <ul className="text-xs text-ink-soft dark:text-slate-300 space-y-1">
                  {importPreview.invalid.slice(0, 50).map((inv) => (
                    <li key={inv.rowNumber}>Row {inv.rowNumber}: {inv.reason}</li>
                  ))}
                </ul>
                {importPreview.invalid.length > 50 && (
                  <p className="text-xs text-ink-faint mt-1">…and {importPreview.invalid.length - 50} more.</p>
                )}
              </div>
            )}
            {importPreview.valid.length === 0 && (
              <p className="text-sm text-critical">No valid rows to import — fix the issues above and re-upload, or download the template for the expected format.</p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => { setConfirmRestore(false); setPendingRestoreFile(null); setRestoreError(''); if (fileRef.current) fileRef.current.value = ''; }}
        onConfirm={doRestore}
        title="Restore backup?" danger confirmLabel="Restore & replace"
        description={restoreError || 'This will replace ALL current data (customers, cases, knowledge base, notifications, audit log) with the contents of the selected file. This cannot be undone.'}
      />
      <ConfirmDialog
        open={confirmClearSample} onClose={() => setConfirmClearSample(false)} onConfirm={doClearSample}
        title="Clear sample data?" danger confirmLabel="Clear sample data"
        description="This removes only records tagged as sample data. Anything you created yourself is not affected."
      />
      <ConfirmDialog
        open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={doResetWorkspace}
        title="Reset workspace?" danger confirmLabel="Erase everything"
        description="This permanently erases all customers, cases, knowledge articles, notifications, audit history, and your workspace profile. You'll be returned to Workspace Setup. This cannot be undone."
      />
    </div>
  );
}
