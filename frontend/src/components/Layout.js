import React, { useContext } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingBag,
  Users,
  FileText,
  Settings,
  LogOut
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useContext(AuthContext);

  const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Billing', path: '/billing', icon: ShoppingCart },
    { name: 'Inventory', path: '/inventory', icon: Package },
    { name: 'Purchases', path: '/purchases', icon: ShoppingBag },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Dark Blue Theme - Compact */}
      <aside className="w-44 bg-[#001F3F] flex flex-col" data-testid="sidebar">
        <div className="p-3 border-b border-blue-900">
          <div className="flex items-center space-x-1.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">PharmaCare</h2>
              <p className="text-xs text-blue-300">v1.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-1.5 px-2 py-1.5 rounded-lg transition-colors text-xs ${
                  isActive
                    ? 'bg-[#4682B4] text-white font-semibold'
                    : 'text-blue-100 hover:bg-blue-900'
                }`
              }
              data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-blue-300'}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-blue-900">
          <div className="mb-1.5">
            <div>
              <p className="text-xs font-medium text-white truncate" data-testid="user-name">{user?.name}</p>
              <p className="text-xs text-blue-300" data-testid="user-role">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 bg-transparent border-blue-700 text-blue-100 hover:bg-blue-900 hover:text-white"
            onClick={logout}
            data-testid="logout-btn"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" data-testid="main-content">
        <Outlet />
      </main>
    </div>
  );
}
