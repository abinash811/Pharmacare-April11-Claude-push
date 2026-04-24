import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import '@/App.css';
import api from '@/lib/axios';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Pages
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import BillingOperations from '@/pages/BillingOperations';
import BillingWorkspace from '@/pages/BillingWorkspace';
import BillDetail from '@/pages/BillDetail';
import SalesReturnsList from '@/pages/SalesReturnsList';
import SalesReturnCreate from '@/pages/SalesReturnCreate';
import SalesReturnDetail from '@/pages/SalesReturnDetail';
import InventorySearch from '@/pages/InventorySearch';
import MedicineDetail from '@/pages/MedicineDetail';
import PurchasesList from '@/pages/PurchasesList';
import PurchaseNew from '@/pages/PurchaseNew';
import PurchaseDetail from '@/pages/PurchaseDetail';
import PurchaseReturnCreate from '@/pages/PurchaseReturnCreate';
import PurchaseReturnDetail from '@/pages/PurchaseReturnDetail';
import PurchaseReturnsList from '@/pages/PurchaseReturnsList';
import Customers from '@/pages/Customers';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';
import RolesPermissions from '@/pages/RolesPermissions';
// Team page — merges Users + Roles into a single tabbed page
let Team;
try { Team = require('@/pages/Team').default; } catch { Team = Users; }
import Suppliers from '@/pages/Suppliers';
import GSTReport from '@/pages/GSTReport';
import ScheduleH1Register from '@/pages/ScheduleH1Register';
import AuditLog from '@/pages/AuditLog';
import StockMovementLog from '@/pages/StockMovementLog';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Auth Context
export const AuthContext = React.createContext(null);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (!localStorage.getItem('token')) { setLoading(false); return; }
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      localStorage.removeItem('token');
    }
    setLoading(false);
  };

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* silent */ }
    setUser(null);
    localStorage.removeItem('token');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, checkAuth }}>
      <BrowserRouter>
        <AppRoutes user={user} />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

function AppRoutes({ user }) {
  const location = useLocation();

  // Handle Emergent OAuth redirect
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1].split('&')[0];
        
        try {
          const response = await api.post('/auth/session', {}, { headers: { 'X-Session-ID': sessionId } });
          
          const userData = response.data.user;
          const token = response.data.session_token || 'emergent-session';
          
          localStorage.setItem('token', token);
          window.location.href = '/dashboard';
        } catch (error) {
          console.error('OAuth callback error:', error);
          toast.error('Authentication failed');
          window.location.href = '/';
        }
      }
    };

    handleOAuthCallback();
  }, [location]);

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ErrorBoundary><Layout /></ErrorBoundary>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="billing" element={<BillingOperations />} />
        <Route path="billing/new" element={<BillingWorkspace />} />
        <Route path="billing/create" element={<BillingWorkspace />} />
        <Route path="billing/edit/:id" element={<BillingWorkspace />} />
        <Route path="billing/returns" element={<SalesReturnsList />} />
        <Route path="billing/returns/new" element={<SalesReturnCreate />} />
        <Route path="billing/returns/edit/:id" element={<SalesReturnCreate />} />
        <Route path="billing/returns/:id" element={<SalesReturnDetail />} />
        <Route path="billing/:id" element={<BillDetail />} />
        <Route path="inventory" element={<InventorySearch />} />
        <Route path="inventory/product/:sku" element={<MedicineDetail />} />
        <Route path="inventory/edit/:sku" element={<MedicineDetail />} />
        <Route path="inventory/stock-movements" element={<StockMovementLog />} />
        <Route path="purchases" element={<PurchasesList />} />
        <Route path="purchases/create" element={<PurchaseNew />} />
        <Route path="purchases/edit/:id" element={<PurchaseNew />} />
        <Route path="purchases/returns" element={<PurchaseReturnsList />} />
        <Route path="purchases/returns/create" element={<PurchaseReturnCreate />} />
        <Route path="purchases/returns/:id" element={<PurchaseReturnDetail />} />
        <Route path="purchases/:id" element={<PurchaseDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/gst" element={<GSTReport />} />
        <Route path="compliance/schedule-h1" element={<ScheduleH1Register />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="settings" element={<Settings />} />
        {/* Legacy routes — kept so old links don't 404 while Team page is built */}
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<RolesPermissions />} />
        {/* New merged Team page */}
        <Route path="team" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
