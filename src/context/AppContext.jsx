import React, { createContext, useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting } from '../db/db';
import { sweepSla } from '../lib/repo';

const AppCtx = createContext(null);
export { AppCtx };

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState(null);
  const [theme, setThemeState] = useState('light');
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Bootstrap: load the workspace profile (if any) and UI prefs, all from IndexedDB.
  useEffect(() => {
    (async () => {
      const storedProfile = await getSetting('workspaceProfile', null);
      const storedTheme = await getSetting('theme', 'light');
      const storedCollapsed = await getSetting('sidebarCollapsed', false);
      setProfileState(storedProfile);
      setThemeState(storedTheme);
      setSidebarCollapsedState(storedCollapsed);
      if (storedProfile) await sweepSla();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const t = setInterval(async () => {
      setNow(Date.now());
      if (profile) await sweepSla();
    }, 20000);
    return () => clearInterval(t);
  }, [profile]);

  const setTheme = useCallback(async (t) => { setThemeState(t); await setSetting('theme', t); }, []);
  const setSidebarCollapsed = useCallback(async (v) => { setSidebarCollapsedState(v); await setSetting('sidebarCollapsed', v); }, []);

  const completeSetup = useCallback(async (profileData) => {
    await setSetting('workspaceProfile', profileData);
    setProfileState(profileData);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const next = { ...(profile || {}), ...patch };
    await setSetting('workspaceProfile', next);
    setProfileState(next);
  }, [profile]);

  const resetWorkspace = useCallback(async () => {
    const tables = ['customers', 'cases', 'agents', 'knowledgeArticles', 'notifications', 'auditEvents', 'settings'];
    await db.transaction('rw', tables.map((t) => db[t]), async () => {
      for (const t of tables) await db[t].clear();
    });
    setProfileState(null);
    setThemeState('light');
    setSidebarCollapsedState(false);
  }, []);

  const unreadCount = useLiveQuery(() => db.notifications.where('read').equals(0).count(), []) ?? 0;

  const value = {
    ready, profile, role: profile?.role || null, completeSetup, updateProfile, resetWorkspace,
    theme, setTheme, sidebarCollapsed, setSidebarCollapsed, now, unreadCount,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
