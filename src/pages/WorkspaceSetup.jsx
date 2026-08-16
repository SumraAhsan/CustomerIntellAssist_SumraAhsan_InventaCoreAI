import React, { useState } from 'react';
import { Sparkles, FileX, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import { loadSampleData } from '../lib/seed';
import { Button, Field, Input, Select, Card } from '../components/ui/ui';
import AmbientBackground from '../components/layout/AmbientBackground';
import { ROLES } from '../lib/constants';

export default function WorkspaceSetup() {
  const { completeSetup } = useApp();
  const [step, setStep] = useState('profile'); // profile | starting-point | done
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [role, setRole] = useState('Administrator');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function submitProfile(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter your name.'); return; }
    if (!workspaceName.trim()) { setError('Enter a workspace name.'); return; }
    setError('');
    setStep('starting-point');
  }

  async function finish(withSample) {
    setBusy(true);
    setError('');
    try {
      if (withSample) {
        // Load sample data and show an explicit confirmation BEFORE marking
        // setup complete. completeSetup() flips the app into the main Shell
        // immediately, which would unmount this screen — so it must be the
        // very last thing that happens, after the user has actually seen
        // confirmation that sample data finished loading.
        await loadSampleData(name.trim());
        setStep('done');
      } else {
        const profileData = { name: name.trim(), workspaceName: workspaceName.trim(), role };
        await completeSetup(profileData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function enterWorkspace() {
    const profileData = { name: name.trim(), workspaceName: workspaceName.trim(), role };
    await completeSetup(profileData);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-bg dark:bg-surface-dark px-4 relative">
      <AmbientBackground />
      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-white font-display font-bold text-lg mb-3">CI</div>
          <h1 className="font-display font-semibold text-xl text-ink dark:text-white">Welcome to Customer IntellAssist</h1>
          <p className="text-sm text-ink-faint mt-1">Set up your workspace to get started</p>
        </div>

        {step === 'profile' && (
          <Card as="form" onSubmit={submitProfile} className="space-y-4">
            <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Sumra Ahsan" /></Field>
            <Field label="Workspace name"><Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="e.g. Acme Support" /></Field>
            <Field label="Your role" hint="Controls what you can do in this workspace.">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            {error && <p className="text-sm text-critical">{error}</p>}
            <Button type="submit" className="w-full" size="lg">Continue</Button>
          </Card>
        )}

        {step === 'starting-point' && (
          <Card className="space-y-4">
            <p className="text-sm text-ink-soft dark:text-slate-400">How would you like to start?</p>
            <button
              type="button" onClick={() => finish(true)} disabled={busy}
              className="w-full text-left rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-navy dark:hover:border-info transition-colors flex items-start gap-3 disabled:opacity-60"
            >
              <Sparkles size={18} className="text-intel mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-ink dark:text-slate-100">Start with sample workspace</p>
                <p className="text-xs text-ink-faint mt-0.5">Loads realistic sample customers, cases, and knowledge articles — clearly marked as sample data, and removable anytime from Settings.</p>
              </div>
            </button>
            <button
              type="button" onClick={() => finish(false)} disabled={busy}
              className="w-full text-left rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-navy dark:hover:border-info transition-colors flex items-start gap-3 disabled:opacity-60"
            >
              <FileX size={18} className="text-ink-faint mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-ink dark:text-slate-100">Start with empty workspace</p>
                <p className="text-xs text-ink-faint mt-0.5">Begin with no data and add your own customers and cases.</p>
              </div>
            </button>
            {busy && <p className="text-xs text-ink-faint text-center">Setting up your workspace…</p>}
            {error && <p className="text-sm text-critical text-center">{error}</p>}
          </Card>
        )}

        {step === 'done' && (
          <Card className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-success-soft flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} className="text-success" />
            </div>
            <div>
              <p className="font-medium text-sm text-ink dark:text-slate-100">Sample data loaded</p>
              <p className="text-xs text-ink-faint mt-1">38 customers, 72 cases, and 7 knowledge articles are ready to explore.</p>
            </div>
            <Button className="w-full" onClick={enterWorkspace}>
              Enter workspace
            </Button>
          </Card>
        )}

        <p className="text-center text-xs text-ink-faint mt-4">All data stays on this device (IndexedDB). Nothing is sent to a server.</p>
      </div>
    </div>
  );
}
