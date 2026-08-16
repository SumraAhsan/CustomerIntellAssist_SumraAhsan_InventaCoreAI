import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Users, AlertTriangle, ListChecks, Sparkles, BookOpen,
  TrendingUp, UsersRound, FileBarChart, History, Bell, Settings, ChevronsLeft, ChevronsRight, X,
} from 'lucide-react';
import { useApp } from '../../context/useApp';

const SECTIONS = [
  { label: 'OVERVIEW', items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true }] },
  {
    label: 'CUSTOMER OPERATIONS',
    items: [
      { to: '/cases', icon: Inbox, label: 'Cases' },
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/complaints', icon: AlertTriangle, label: 'Complaints' },
      { to: '/queue', icon: ListChecks, label: 'My Queue' },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { to: '/insights', icon: Sparkles, label: 'AI Insights' },
      { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base' },
      { to: '/trends', icon: TrendingUp, label: 'Trends' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { to: '/team', icon: UsersRound, label: 'Team' },
      { to: '/reports', icon: FileBarChart, label: 'Reports' },
      { to: '/audit', icon: History, label: 'Audit Log' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function SidebarContent({ collapsed, unreadCount, onNavigate, onClose, isMobile }) {
  return (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 h-16 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-white font-display font-bold text-sm shrink-0">CI</div>
        {!collapsed && (
          <div className="leading-tight overflow-hidden flex-1">
            <div className="font-display font-semibold text-sm text-ink dark:text-white truncate">IntellAssist</div>
            <div className="text-[11px] text-ink-faint truncate">Understand. Assist. Resolve.</div>
          </div>
        )}
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-ink-soft dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="px-3 text-[10px] font-semibold tracking-wider text-ink-faint mb-1">{section.label}</div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'bg-navy text-white'
                      : 'text-ink-soft dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {item.label === 'Notifications' && unreadCount > 0 && (
                    <span className={`ml-auto ${collapsed ? 'absolute -top-0.5 -right-0.5' : ''} bg-accent text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!isMobile && (
        <div className="p-2 border-t border-black/5 dark:border-white/10">
          <button
            onClick={onClose}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-soft dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </nav>
  );
}

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { sidebarCollapsed, setSidebarCollapsed, unreadCount } = useApp();

  return (
    <>
      <aside className={`hidden md:flex flex-col shrink-0 border-r border-black/5 dark:border-white/10 bg-surface-card dark:bg-surface-darkcard transition-all duration-200 ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}`}>
        <SidebarContent
          collapsed={sidebarCollapsed}
          unreadCount={unreadCount}
          onNavigate={undefined}
          onClose={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={false}
        />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-surface-card dark:bg-surface-darkcard shadow-pop">
            {/* Mobile drawer always shows full labels — the desktop icon-only
                collapse preference has no meaning here, and the explicit X
                button above is always visible so the drawer never gets stuck open. */}
            <SidebarContent
              collapsed={false}
              unreadCount={unreadCount}
              onNavigate={onCloseMobile}
              onClose={onCloseMobile}
              isMobile
            />
          </aside>
        </div>
      )}
    </>
  );
}
