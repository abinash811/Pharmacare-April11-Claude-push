import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, Printer, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalesReturnsList() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterTime, setFilterTime] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [bills, searchQuery, filterStatus, filterMethod, filterTime]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [billsRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/bills?invoice_type=SALE`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/analytics/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBills(billsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...bills];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(bill =>
        bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.customer_mobile?.includes(searchQuery)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(bill => bill.status === filterStatus);
    }

    // Payment method filter
    if (filterMethod !== 'all') {
      filtered = filtered.filter(bill => bill.payment_method === filterMethod);
    }

    // Time filter
    if (filterTime !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.created_at);
        if (filterTime === 'today') return billDate >= today;
        if (filterTime === 'week') return billDate >= week;
        if (filterTime === 'month') return billDate >= month;
        return true;
      });
    }

    setFilteredBills(filtered);
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700',
      due: 'bg-orange-100 text-orange-700',
      draft: 'bg-gray-200 text-gray-700'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.paid}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Stats */}
      <div className="bg-white border-b px-8 py-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bills & Invoices</h1>
            <p className="text-sm text-gray-600">Track and manage billing</p>
          </div>
          <Button
            onClick={() => navigate('/billing/create')}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="new-bill-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Bill
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Revenue</div>
              <div className="text-2xl font-bold text-green-600">
                ₹{analytics?.gross_sales?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Pending</div>
              <div className="text-2xl font-bold text-orange-600">
                ₹{analytics?.pending_amount?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Today</div>
              <div className="text-2xl font-bold text-blue-600">
                ₹{analytics?.today_sales?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Drafts</div>
              <div className="text-2xl font-bold text-gray-600">
                {analytics?.draft_count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search patient, mobile, bill #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
              <select
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="due">Due</option>
                <option value="draft">Draft</option>
              </select>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Method</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Bill #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Patient Details</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Method</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-gray-500">
                        No bills found
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => (
                      <tr key={bill.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="font-medium text-blue-600">{bill.bill_number}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-800">
                            {bill.customer_name || 'Walk-in'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {bill.customer_mobile || 'N/A'}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {new Date(bill.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 font-semibold text-gray-800">
                          ₹{bill.total_amount.toFixed(2)}
                        </td>
                        <td className="py-4 px-4">
                          <span className="capitalize text-sm text-gray-600">
                            {bill.payment_method}
                          </span>
                        </td>
                        <td className="py-4 px-4">{getStatusBadge(bill.status)}</td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button className="p-2 hover:bg-gray-100 rounded">
                              <Printer className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-2 hover:bg-gray-100 rounded">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
