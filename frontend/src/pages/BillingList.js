import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Printer, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BillingList() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [filteredReturns, setFilteredReturns] = useState([]);
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
  }, [bills, returns, searchQuery, filterStatus, filterMethod, filterTime]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [billsRes, returnsRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/bills?invoice_type=SALE`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/bills?invoice_type=SALES_RETURN`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/analytics/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBills(billsRes.data);
      setReturns(returnsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const applyFilters = () => {
    // Filter bills
    let filteredB = [...bills];
    let filteredR = [...returns];

    // Search filter
    if (searchQuery) {
      filteredB = filteredB.filter(bill =>
        bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.customer_mobile?.includes(searchQuery)
      );
      filteredR = filteredR.filter(ret =>
        ret.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customer_mobile?.includes(searchQuery)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filteredB = filteredB.filter(bill => bill.status === filterStatus);
      filteredR = filteredR.filter(ret => ret.status === filterStatus);
    }

    // Payment method filter
    if (filterMethod !== 'all') {
      filteredB = filteredB.filter(bill => bill.payment_method === filterMethod);
      filteredR = filteredR.filter(ret => ret.payment_method === filterMethod);
    }

    // Time filter
    if (filterTime !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filteredB = filteredB.filter(bill => {
        const billDate = new Date(bill.created_at);
        if (filterTime === 'today') return billDate >= today;
        if (filterTime === 'week') return billDate >= week;
        if (filterTime === 'month') return billDate >= month;
        return true;
      });

      filteredR = filteredR.filter(ret => {
        const retDate = new Date(ret.created_at);
        if (filterTime === 'today') return retDate >= today;
        if (filterTime === 'week') return retDate >= week;
        if (filterTime === 'month') return retDate >= month;
        return true;
      });
    }

    setFilteredBills(filteredB);
    setFilteredReturns(filteredR);
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700',
      due: 'bg-orange-100 text-orange-700',
      draft: 'bg-gray-200 text-gray-700',
      refunded: 'bg-blue-100 text-blue-700'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.paid}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const renderTable = (data, isReturn = false) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{isReturn ? 'Return' : 'Bill'} #</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Patient Details</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Method</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
            {isReturn && <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Original Bill</th>}
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={isReturn ? 8 : 7} className="text-center py-12 text-gray-500">
                {isReturn ? 'No returns found' : 'No bills found'}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="py-4 px-4">
                  <div 
                    className="font-medium text-blue-600 cursor-pointer hover:underline"
                    onClick={() => navigate(`/billing/${item.id}`)}
                  >
                    {item.bill_number}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="font-medium text-gray-800">
                    {item.customer_name || 'Walk-in'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {item.customer_mobile || 'N/A'}
                  </div>
                </td>
                <td className="py-4 px-4 text-sm text-gray-600">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
                <td className="py-4 px-4 font-semibold text-gray-800">
                  ₹{item.total_amount.toFixed(2)}
                </td>
                <td className="py-4 px-4">
                  <span className="capitalize text-sm text-gray-600">
                    {item.payment_method}
                  </span>
                </td>
                <td className="py-4 px-4">{getStatusBadge(item.status)}</td>
                {isReturn && (
                  <td className="py-4 px-4 text-sm text-gray-600">
                    {item.ref_invoice_id ? (
                      <span className="text-blue-600 font-medium">
                        {bills.find(b => b.id === item.ref_invoice_id)?.bill_number || 'N/A'}
                      </span>
                    ) : (
                      <span className="text-orange-600">Not Linked</span>
                    )}
                  </td>
                )}
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
  );

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Stats */}
      <div className="bg-white border-b px-8 py-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bills & Returns Management</h1>
            <p className="text-sm text-gray-600">Track sales and returns in one place</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Gross Sales</div>
              <div className="text-2xl font-bold text-green-600">
                ₹{analytics?.gross_sales?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Returns</div>
              <div className="text-2xl font-bold text-red-600">
                ₹{analytics?.returns?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Net Sales</div>
              <div className="text-2xl font-bold text-blue-600">
                ₹{analytics?.net_sales?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Return %</div>
              <div className="text-2xl font-bold text-gray-600">
                {analytics?.return_percentage?.toFixed(1) || 0}%
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="p-8">
        <Tabs defaultValue="sales" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList>
              <TabsTrigger value="sales" data-testid="sales-tab">Sales</TabsTrigger>
              <TabsTrigger value="returns" data-testid="returns-tab">Returns</TabsTrigger>
            </TabsList>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate('/billing/create?type=sale')}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="new-sale-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Sale
              </Button>
              <Button
                onClick={() => navigate('/billing/create?type=return')}
                variant="outline"
                data-testid="new-return-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Return
              </Button>
            </div>
          </div>

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
                  <option value="refunded">Refunded</option>
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

              <TabsContent value="sales" className="mt-0">
                {renderTable(filteredBills, false)}
              </TabsContent>

              <TabsContent value="returns" className="mt-0">
                {renderTable(filteredReturns, true)}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
