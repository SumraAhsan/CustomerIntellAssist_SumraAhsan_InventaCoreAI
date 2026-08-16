import React from 'react';

// Subtle, slow-moving ambient gradient — decorative only, sits behind all
// content (pointer-events-none) and is disabled via the global
// prefers-reduced-motion rule in index.css.
export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-40 dark:opacity-30 bg-info/30 dark:bg-intel/25 animate-drift-slow" />
      <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-30 dark:opacity-25 bg-accent/25 dark:bg-navy-light/40 animate-drift-slower" />
      <div className="absolute bottom-[-10rem] left-1/4 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-25 dark:opacity-20 bg-navy/10 dark:bg-intel/20 animate-drift-slow" />
    </div>
  );
}
