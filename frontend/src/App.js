import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Pages
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import BillingList from '@/pages/BillingList';
import BillingOperations from '@/pages/BillingOperations';
import Billing from '@/pages/BillingNew';
import BillingWorkspace from '@/pages/BillingWorkspace';
import BillDetail from '@/pages/BillDetail';
import Inventory from '@/pages/InventoryImproved';
import InventoryV2 from '@/pages/InventoryV2';
import InventorySearch from '@/pages/InventorySearch';
import Purchases from '@/pages/Purchases';
import PurchasesList from '@/pages/PurchasesList';
import PurchaseNew from '@/pages/PurchaseNew';
import PurchaseDetail from '@/pages/PurchaseDetail';
import Customers from '@/pages/Customers';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';
import RolesPermissions from '@/pages/RolesPermissions';
import Suppliers from '@/pages/Suppliers';
import GSTReport from '@/pages/GSTReport';
import Layout from '@/components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = React.createContext(null);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    }
    setLoading(false);
  };

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
          const response = await axios.post(`${API}/auth/session`, {}, {
            headers: { 'X-Session-ID': sessionId }
          });
          
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
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="billing" element={<BillingOperations />} />
        <Route path="billing/new" element={<BillingWorkspace />} />
        <Route path="billing/create" element={<BillingWorkspace />} />
        <Route path="billing/edit/:id" element={<Billing />} />
        <Route path="billing/:id" element={<BillDetail />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory-v2" element={<InventoryV2 />} />
        <Route path="purchases" element={<PurchasesList />} />
        <Route path="purchases/create" element={<PurchaseNew />} />
        <Route path="purchases/edit/:id" element={<PurchaseNew />} />
        <Route path="purchases/:id" element={<PurchaseDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/gst" element={<GSTReport />} />
        <Route path="settings" element={<Settings />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<RolesPermissions />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
