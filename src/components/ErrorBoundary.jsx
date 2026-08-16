import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Local-only diagnostic log — no server, nothing leaves the device.
    console.error('Customer IntellAssist crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-surface-bg dark:bg-surface-dark px-4">
          <div className="max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-critical-soft flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-critical" />
            </div>
            <h1 className="font-display font-semibold text-lg text-ink dark:text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-ink-soft dark:text-slate-400 mb-4">
              This screen ran into an unexpected error. Your data is safe — it lives in this browser's local
              database and was not affected. Reloading usually fixes this.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy-light"
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
