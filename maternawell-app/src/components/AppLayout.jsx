import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, FileText, HelpCircle, LayoutDashboard, LogOut, Menu, PlusCircle, ScrollText, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LanguageSelector, useLanguage } from '../context/LanguageContext';
import SyncStatusChip from './SyncStatusChip';

const ROLE_LABELS = { health_worker: 'Health worker', supervisor: 'Facility supervisor', admin: 'System administrator' };

export function navItemsFor(role) {
  if (role === 'supervisor') return [
    { to: '/supervisor', key: 'supervisor', icon: ShieldCheck },
    { to: '/screenings', key: 'cases', icon: ClipboardList },
    { to: '/help', key: 'help', icon: HelpCircle }
  ];
  if (role === 'admin') return [
    { to: '/admin', key: 'auditTrail', icon: ScrollText },
    { to: '/help', key: 'help', icon: HelpCircle }
  ];
  return [
    { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
    { to: '/new-screening', key: 'newScreening', icon: PlusCircle },
    { to: '/screenings', key: 'cases', icon: ClipboardList },
    { to: '/help', key: 'help', icon: HelpCircle }
  ];
}

/** Shared shell for signed-in staff: role-based navigation, sync status, language. */
export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760);

  return (
    <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 88 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="dashboard-sidebar no-print"
        aria-label="Main navigation"
      >
        <div className="sidebar-brand-row">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon"><FileText size={24} color="white" aria-hidden="true" /></div>
            {sidebarOpen && (
              <div className="sidebar-brand-copy">
                <h1>Maternawell</h1>
                <p>Nigeria · PHC</p>
              </div>
            )}
          </div>
          <button type="button" className="sidebar-toggle" onClick={() => setSidebarOpen(open => !open)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItemsFor(user?.role).map(({ to, key, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title={!sidebarOpen ? t(key) : undefined} aria-label={t(key)}>
              <Icon size={20} aria-hidden="true" />
              {sidebarOpen && <span>{t(key)}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen ? (
            <div className="sidebar-user-card">
              <p className="sidebar-user-kicker">{ROLE_LABELS[user?.role] || 'Signed in'}</p>
              <p className="sidebar-user-name">{user?.name} ({user?.staffId})</p>
              <p className="sidebar-user-facility">{user?.facility}</p>
            </div>
          ) : (
            <div className="sidebar-user-compact" title={`${user?.name} - ${user?.facility}`}>{user?.staffId?.slice(0, 3)}</div>
          )}
          <button type="button" className="sidebar-logout" onClick={async () => { await logout(); navigate('/login'); }}
            title={!sidebarOpen ? t('signOut') : undefined} aria-label={t('signOut')}>
            <LogOut size={20} aria-hidden="true" />
            {sidebarOpen && <span>{t('signOut')}</span>}
          </button>
        </div>
      </motion.aside>

      <main className="dashboard-main" id="main">
        <header className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-7">
          <p className="text-sm font-semibold text-slate-700">{user?.facility}</p>
          <div className="flex flex-wrap items-center gap-3">
            <SyncStatusChip />
            <LanguageSelector />
          </div>
        </header>
        <div className="px-4 py-6 sm:px-7">{children}</div>
      </main>
    </div>
  );
}
