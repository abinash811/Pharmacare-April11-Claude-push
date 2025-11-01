import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Package, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [statsRes, lowStockRes, expiringRes] = await Promise.all([
        axios.get(`${API}/reports/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/medicines/alerts/low-stock`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/medicines/alerts/expiring-soon`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setStats(statsRes.data);
      setLowStock(lowStockRes.data);
      setExpiringSoon(expiringRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="dashboard">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-600">Overview of your pharmacy operations</p>
      </div>

      {/* Stats Grid - More compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card data-testid="today-sales-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-medium text-gray-600">Today's Sales</CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-gray-800" data-testid="today-sales-value">
              ₹{stats?.today_sales?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="total-sales-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-medium text-gray-600">Total Sales</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-gray-800" data-testid="total-sales-value">
              ₹{stats?.total_sales?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="total-medicines-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-medium text-gray-600">Total Medicines</CardTitle>
            <Package className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-gray-800" data-testid="total-medicines-value">
              {stats?.total_medicines || 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stock-value-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs font-medium text-gray-600">Stock Value</CardTitle>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-gray-800" data-testid="stock-value">
              ₹{stats?.total_stock_value?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts - More compact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Alert */}
        <Card data-testid="low-stock-alert">
          <CardHeader className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <CardTitle className="text-base">Low Stock Alerts</CardTitle>
            </div>
            <CardDescription className="text-xs">{lowStock.length} items running low</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {lowStock.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">No low stock items</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto">
                {lowStock.slice(0, 5).map((med) => (
                  <div
                    key={med.id}
                    className="flex justify-between items-center p-2 bg-orange-50 rounded-lg"
                    data-testid={`low-stock-item-${med.id}`}
                  >
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{med.name}</p>
                      <p className="text-xs text-gray-600">Batch: {med.batch_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-orange-600">{med.quantity}</p>
                      <p className="text-xs text-gray-500">units left</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon Alert */}
        <Card data-testid="expiring-soon-alert">
          <CardHeader className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <CardTitle className="text-base">Expiring Soon</CardTitle>
            </div>
            <CardDescription className="text-xs">{expiringSoon.length} items expiring in 30 days</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {expiringSoon.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">No medicines expiring soon</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto">
                {expiringSoon.slice(0, 5).map((med) => (
                  <div
                    key={med.id}
                    className="flex justify-between items-center p-2 bg-red-50 rounded-lg"
                    data-testid={`expiring-item-${med.id}`}
                  >
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{med.name}</p>
                      <p className="text-xs text-gray-600">Batch: {med.batch_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-red-600">
                        {new Date(med.expiry_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">expiry date</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
