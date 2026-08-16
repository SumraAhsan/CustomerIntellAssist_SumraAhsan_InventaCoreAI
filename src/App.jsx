import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/useApp';
import Shell from './components/layout/Shell';
import WorkspaceSetup from './pages/WorkspaceSetup';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Cases = lazy(() => import('./pages/Cases'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Complaints = lazy(() => import('./pages/Complaints'));
const Queue = lazy(() => import('./pages/Queue'));
const Insights = lazy(() => import('./pages/Insights'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const Trends = lazy(() => import('./pages/Trends'));
const Team = lazy(() => import('./pages/Team'));
const Reports = lazy(() => import('./pages/Reports'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-slate-200 dark:bg-white/10 rounded-xl2" />
      <div className="h-64 bg-slate-200 dark:bg-white/10 rounded-xl2" />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-bg dark:bg-surface-dark">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-navy animate-pulse" />
        <p className="text-sm text-ink-faint">Loading your workspace…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { ready, profile } = useApp();

  if (!ready) return <LoadingScreen />;
  if (!profile) return <WorkspaceSetup />;

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="/cases" element={<Suspense fallback={<PageFallback />}><Cases /></Suspense>} />
          <Route path="/cases/:id" element={<Suspense fallback={<PageFallback />}><CaseDetail /></Suspense>} />
          <Route path="/customers" element={<Suspense fallback={<PageFallback />}><Customers /></Suspense>} />
          <Route path="/customers/:id" element={<Suspense fallback={<PageFallback />}><CustomerDetail /></Suspense>} />
          <Route path="/complaints" element={<Suspense fallback={<PageFallback />}><Complaints /></Suspense>} />
          <Route path="/queue" element={<Suspense fallback={<PageFallback />}><Queue /></Suspense>} />
          <Route path="/insights" element={<Suspense fallback={<PageFallback />}><Insights /></Suspense>} />
          <Route path="/knowledge" element={<Suspense fallback={<PageFallback />}><Knowledge /></Suspense>} />
          <Route path="/trends" element={<Suspense fallback={<PageFallback />}><Trends /></Suspense>} />
          <Route path="/team" element={<Suspense fallback={<PageFallback />}><Team /></Suspense>} />
          <Route path="/reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
          <Route path="/audit" element={<Suspense fallback={<PageFallback />}><AuditLog /></Suspense>} />
          <Route path="/notifications" element={<Suspense fallback={<PageFallback />}><Notifications /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
