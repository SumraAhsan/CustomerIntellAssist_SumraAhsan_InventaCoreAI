import React from 'react';

const COLOR_MAP = {
  navy: 'bg-navy/10 text-navy dark:bg-white/10 dark:text-slate-100',
  info: 'bg-info-soft text-info dark:bg-info/20 dark:text-blue-300',
  success: 'bg-success-soft text-success dark:bg-success/20 dark:text-emerald-300',
  warn: 'bg-warn-soft text-warn dark:bg-warn/20 dark:text-amber-300',
  critical: 'bg-critical-soft text-critical dark:bg-critical/20 dark:text-red-300',
  intel: 'bg-intel-soft text-intel dark:bg-intel/20 dark:text-violet-300',
  neutral: 'bg-slate-100 text-ink-soft dark:bg-white/10 dark:text-slate-300',
};

export function Badge({ color = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${COLOR_MAP[color] || COLOR_MAP.neutral} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '', as: As = 'div', ...rest }) {
  return <As className={`card p-5 ${className}`} {...rest}>{children}</As>;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  const variants = {
    primary: 'bg-navy text-white hover:bg-navy-light disabled:opacity-50',
    accent: 'bg-accent text-white hover:brightness-95 disabled:opacity-50',
    ghost: 'bg-transparent text-ink dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10',
    outline: 'border border-black/10 dark:border-white/15 text-ink dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5',
    danger: 'bg-critical text-white hover:brightness-95 disabled:opacity-50',
    subtle: 'bg-slate-100 dark:bg-white/10 text-ink dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
          <Icon size={22} className="text-ink-faint" />
        </div>
      )}
      <h3 className="font-display font-semibold text-ink dark:text-slate-100 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-soft dark:text-slate-400 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-white/10 rounded-md ${className}`} />;
}

export function SkeletonCard() {
  return (
    <Card className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </Card>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink dark:text-slate-200 mb-1">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-faint mt-1">{hint}</span>}
      {error && <span className="block text-xs text-critical mt-1">{error}</span>}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-navy-deep px-3 py-2 text-sm text-ink dark:text-slate-100 placeholder:text-ink-faint focus-visible:outline-none focus:border-navy dark:focus:border-info ${props.className || ''}`}
    />
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-navy-deep px-3 py-2 text-sm text-ink dark:text-slate-100 placeholder:text-ink-faint focus-visible:outline-none focus:border-navy dark:focus:border-info ${props.className || ''}`}
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-navy-deep px-3 py-2 text-sm text-ink dark:text-slate-100 focus-visible:outline-none focus:border-navy dark:focus:border-info ${props.className || ''}`}
    />
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} card p-0 overflow-hidden max-h-[85vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
          <h3 className="font-display font-semibold text-ink dark:text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="text-ink-faint hover:text-ink dark:hover:text-white px-2">✕</button>
        </div>
        <div className="p-5 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-black/5 dark:border-white/10 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, danger = false, confirmLabel = 'Confirm' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="text-sm text-ink-soft dark:text-slate-400">{description}</p>
    </Modal>
  );
}

export function ProgressBar({ pct, color = 'navy' }) {
  const barColor = {
    navy: 'bg-navy', success: 'bg-success', warn: 'bg-warn', critical: 'bg-critical', info: 'bg-info',
  }[color] || 'bg-navy';
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
      <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
