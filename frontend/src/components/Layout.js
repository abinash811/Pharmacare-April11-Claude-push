/**
 * Layout — App shell with design-system-compliant sidebar
 *
 * Spec (SKILL.md):
 *   bg: #1a2332 · width: 200px · inactive: text-gray-300 · hover: bg-white/5
 *   active: bg-blue-600/20 text-white · font: 13px font-medium · item h: 36px
 *   groups: DAILY OPS / RELATIONSHIPS / REPORTS / COMPLIANCE / ADMIN
 */
import React, { useContext, useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { AuthContext } from '@/App';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingBag,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  UserCog,
} from 'lucide-react';

// ── Nav definition with group labels ─────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'DAILY OPS',
    items: [
      { name: 'Dashboard',  path: '/dashboard',  icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier', 'inventory_staff'] },
      { name: 'Billing',    path: '/billing',    icon: ShoppingCart,    roles: ['admin', 'manager', 'cashier'] },
      { name: 'Inventory',  path: '/inventory',  icon: Package,         roles: ['admin', 'manager', 'cashier', 'inventory_staff'] },
      { name: 'Purchases',  path: '/purchases',  icon: ShoppingBag,     roles: ['admin', 'manager', 'inventory_staff'] },
    ],
  },
  {
    label: 'RELATIONSHIPS',
    items: [
      { name: 'Customers', path: '/customers', icon: Users,     roles: ['admin', 'manager', 'cashier'] },
      { name: 'Suppliers', path: '/suppliers', icon: ShoppingBag, roles: ['admin', 'manager', 'inventory_staff'] },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { name: 'Reports', path: '/reports', icon: FileText, roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'COMPLIANCE',
    items: [
      { name: 'Sch H1 Register', path: '/compliance/schedule-h1', icon: FileText, roles: ['admin', 'manager'] },
      { name: 'Audit Log',       path: '/audit-log',              icon: FileText, roles: ['admin'] },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
      { name: 'Team',     path: '/team',     icon: UserCog,  roles: ['admin'] },
    ],
  },
];

// ── Role badge (muted colors per spec) ────────────────────────────────────────
const ROLE_BADGE = {
  admin:           'bg-purple-50 text-purple-700',
  manager:         'bg-blue-50   text-blue-700',
  cashier:         'bg-green-50  text-green-700',
  inventory_staff: 'bg-orange-50 text-orange-700',
};
const ROLE_LABEL = {
  admin: 'Admin', manager: 'Manager', cashier: 'Cashier', inventory_staff: 'Inventory',
};

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const roleBadge = ROLE_BADGE[user?.role] ?? 'bg-gray-100 text-gray-600';
  const roleLabel = ROLE_LABEL[user?.role] ?? (user?.role ?? '');

  // Filter each group's items by role, drop groups with no visible items
  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i => i.roles.includes(user?.role)),
  })).filter(g => g.items.length > 0);

  /* ── Shared sidebar markup ───────────────────────────────────────────── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo strip */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-white/10 flex-shrink-0">
        <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">PharmaCare</p>
          <p className="text-[10px] text-gray-500 leading-tight">v1.0</p>
        </div>
        {/* Mobile close */}
        <button
          className="md:hidden text-gray-400 hover:text-white transition-colors"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500 px-3 mt-4 mb-1 first:mt-2">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 h-9 rounded-lg transition-colors text-[13px] font-medium mb-0.5 ${
                    isActive
                      ? 'bg-blue-600/20 text-white'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-300">
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate leading-tight" data-testid="user-name">
              {user?.name}
            </p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${roleBadge}`} data-testid="user-role">
              {roleLabel}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          data-testid="logout-btn"
          className="w-full flex items-center gap-2 px-3 h-8 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-page overflow-hidden">

      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-[200px] bg-sidebar flex-col flex-shrink-0"
        data-testid="sidebar"
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[200px] bg-sidebar flex flex-col flex-shrink-0
          transform transition-transform duration-200 ease-in-out md:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        data-testid="mobile-sidebar"
        aria-label="Mobile navigation"
      >
        <SidebarContent />
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-sidebar border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Open menu"
            data-testid="hamburger-btn"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">PharmaCare</span>
          </div>
          <div className="flex-1" />
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${roleBadge}`}>{roleLabel}</span>
        </header>

        <main className="flex-1 overflow-auto" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
