import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, cn } from '../utils';
import { useAlerts } from '../hooks/useAlerts';
import { Badge } from '../components/ui';
import {
  LayoutDashboard,
  FileText,
  Bell,
  Settings,
  LogOut,
  AlertTriangle,
  Menu,
  Scale,
  User,
  ShieldCheck,
  Search,
  ChevronDown,
  Mail,
} from 'lucide-react';
import { useState } from 'react';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { rappels, dormants, contentieux } = useAlerts();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const alertCount = rappels.length + dormants.length + contentieux.length;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isCommercial = user?.role === 'commercial';

  const links = isCommercial
    ? [
        { to: '/mes-dossiers', icon: User, label: 'Mes Dossiers' },
        { to: '/alertes', icon: Bell, label: 'Alertes', badge: alertCount },
      ]
    : [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/dossiers', icon: FileText, label: 'Dossiers' },
        { to: '/alertes', icon: Bell, label: 'Alertes', badge: alertCount },
        ...(user?.role === 'admin' || user?.role === 'responsable_recouvrement'
          ? [{ to: '/derogation', icon: Scale, label: 'Dérogation' }]
          : []),
        ...(user?.role === 'admin'
          ? [{ to: '/admin', icon: Settings, label: 'Paramètres' }]
          : []),
      ];

  return (
    <div className="flex h-[100dvh] bg-[#f4f5f8]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Dark Vertical Navigation Sidebar (Inspired by reference UI) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111827] text-slate-300 border-r border-slate-800/80 transform transition-transform duration-200 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-brand-600/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">PROGAD</h1>
            <p className="text-xs text-slate-400 font-medium">Suivi Impayé</p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <link.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{link.label}</span>
              {link.badge !== undefined && link.badge > 0 && (
                <Badge tone="danger" pill className="bg-danger-600 text-white px-2 py-0.5 text-xs font-bold shadow-xs">
                  {link.badge}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-600/20 text-sm font-bold text-brand-300">
              {user?.nom?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.nom}</p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
          >
            <LogOut className="w-4 h-4 text-danger-400" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Desktop & Mobile Header Bar */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Espace de Gestion</h2>
              <p className="text-xs text-gray-500 hidden sm:block">Dernière mise à jour: Aujourd'hui</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick date display */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/80 text-xs font-medium text-gray-600 border border-gray-200/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Session active: <span className="text-gray-900 font-semibold">{user?.nom}</span>
            </div>

            {/* Notification alert icon */}
            <NavLink
              to="/alertes"
              className="relative p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-xl transition-colors"
              title="Alertes relances"
            >
              <Bell className="w-5 h-5" />
              {alertCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger-600 rounded-full ring-2 ring-white" />
              )}
            </NavLink>

            {/* Account menu */}
            <div className="relative border-l border-gray-200 pl-2">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex items-center gap-2 rounded-xl p-1.5 pr-2 text-left transition hover:bg-gray-100"
                aria-expanded={accountOpen}
                aria-label="Ouvrir le menu du compte"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
                  {user?.nom?.charAt(0) || 'U'}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="max-w-[150px] truncate text-xs font-bold text-gray-900">{user?.nom}</p>
                  <p className="text-[10px] text-gray-500">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
                </div>
                <ChevronDown className={cn('hidden h-4 w-4 text-gray-400 transition sm:block', accountOpen && 'rotate-180')} />
              </button>

              {accountOpen && (
                <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setAccountOpen(false)}
                  aria-label="Fermer le menu du compte"
                />
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-slate-900/10">
                  <div className="bg-gradient-to-br from-slate-50 to-brand-50/60 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 font-bold text-white shadow-sm">
                        {user?.nom?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-950">{user?.nom}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                          <Mail className="h-3 w-3" /> {user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {user?.role ? ROLE_LABELS[user.role] : ''}
                    </div>
                  </div>
                  <div className="space-y-1 p-2">
                    <button
                      onClick={() => {
                        navigate(isCommercial ? '/mes-dossiers' : '/dashboard');
                        setAccountOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      {isCommercial ? 'Mon portefeuille' : 'Mon espace de gestion'}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Se déconnecter
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic page outlet */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
