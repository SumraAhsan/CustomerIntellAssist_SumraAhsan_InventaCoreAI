import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AmbientBackground from './AmbientBackground';

const TITLES = {
  '/': 'Dashboard',
  '/cases': 'Cases',
  '/customers': 'Customers',
  '/complaints': 'Complaints',
  '/queue': 'My Queue',
  '/insights': 'AI Insights',
  '/knowledge': 'Knowledge Base',
  '/trends': 'Trends',
  '/team': 'Team',
  '/reports': 'Reports',
  '/audit': 'Audit Log',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/cases/')) return 'Case Detail';
  if (pathname.startsWith('/customers/')) return 'Customer';
  return 'Customer IntellAssist';
}

export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-bg dark:bg-surface-dark">
      <AmbientBackground />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={titleFor(location.pathname)} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
