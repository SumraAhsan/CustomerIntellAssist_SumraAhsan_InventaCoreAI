import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Menu, Settings as SettingsIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useApp } from '../../context/useApp';

export default function Header({ title, onOpenMobile }) {
  const { theme, setTheme, profile } = useApp();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useLiveQuery(async () => {
    if (!q.trim()) return null;
    const term = q.trim().toLowerCase();
    const [cases, customers, articles] = await Promise.all([
      db.cases.filter((c) => `${c.id} ${c.subject} ${c.description} ${c.category}`.toLowerCase().includes(term)).limit(5).toArray(),
      db.customers.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(term)).limit(5).toArray(),
      db.knowledgeArticles.filter((a) => a.title.toLowerCase().includes(term)).limit(5).toArray(),
    ]);
    return { cases, customers, articles };
  }, [q]);

  return (
    <header className="h-16 shrink-0 border-b border-black/5 dark:border-white/10 bg-surface-card/80 dark:bg-surface-darkcard/80 backdrop-blur flex items-center gap-3 px-4 sticky top-0 z-30">
      <button className="md:hidden text-ink-soft dark:text-slate-300" onClick={onOpenMobile} aria-label="Open menu"><Menu size={22} /></button>

      <div className="min-w-0">
        <h1 className="font-display font-semibold text-lg text-ink dark:text-white truncate">{title}</h1>
        <p className="text-xs text-ink-faint truncate hidden sm:block">{profile?.workspaceName}</p>
      </div>

      <div className="flex-1 max-w-md ml-2 relative hidden sm:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases, customers, articles…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-white/10 text-sm text-ink dark:text-slate-100 placeholder:text-ink-faint focus-visible:outline-none"
        />
        {results && (results.cases.length + results.customers.length + results.articles.length > 0) && (
          <div className="absolute mt-1 w-full card p-2 max-h-80 overflow-y-auto scrollbar-thin z-40">
            {results.cases.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-ink-faint px-2 mb-1">CASES</div>
                {results.cases.map((c) => (
                  <button key={c.id} onClick={() => { navigate(`/cases/${c.id}`); setQ(''); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-sm text-ink dark:text-slate-200 truncate">#{c.id} · {c.subject}</button>
                ))}
              </div>
            )}
            {results.customers.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-ink-faint px-2 mb-1">CUSTOMERS</div>
                {results.customers.map((c) => (
                  <button key={c.id} onClick={() => { navigate(`/customers/${c.id}`); setQ(''); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-sm text-ink dark:text-slate-200 truncate">{c.name} · {c.email}</button>
                ))}
              </div>
            )}
            {results.articles.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-ink-faint px-2 mb-1">KNOWLEDGE BASE</div>
                {results.articles.map((a) => (
                  <button key={a.id} onClick={() => { navigate(`/knowledge`); setQ(''); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-sm text-ink dark:text-slate-200 truncate">{a.title}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-soft dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <div className="w-7 h-7 rounded-full bg-accent/90 text-white text-xs font-semibold flex items-center justify-center">{profile?.name?.[0]?.toUpperCase() || 'U'}</div>
            <span className="text-sm font-medium text-ink dark:text-slate-200 hidden sm:block max-w-[110px] truncate">{profile?.name}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 card p-1 z-40">
              <div className="px-3 py-2 text-xs text-ink-faint border-b border-black/5 dark:border-white/10 mb-1">
                <div className="font-medium text-ink dark:text-slate-200">{profile?.name}</div>
                <div>{profile?.role}</div>
              </div>
              <button onClick={() => { setMenuOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-ink dark:text-slate-200"><SettingsIcon size={15} /> Workspace settings</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
