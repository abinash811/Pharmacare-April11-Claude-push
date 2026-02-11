import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REFACTORED – Unified Record Workspace Pattern
// Row click opens Record Workspace, removed small view buttons

export default function BillingList() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [filteredReturns, setFilteredReturns] = useState([]);
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
      const [billsRes, returnsRes] = await Promise.all([
        axios.get(`${API}/bills?invoice_type=SALE`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/bills?invoice_type=SALES_RETURN`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBills(billsRes.data);
      setReturns(returnsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const applyFilters = () => {
    // VERIFIED – NO CHANGE to filter logic
    let filteredB = [...bills];
    let filteredR = [...returns];

    if (searchQuery) {
      filteredB = filteredB.filter(bill =>
        bill.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.customer_mobile?.includes(searchQuery)
      );
      filteredR = filteredR.filter(ret =>
        ret.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customer_mobile?.includes(searchQuery)
      );
    }

    if (filterStatus !== 'all') {
      filteredB = filteredB.filter(bill => bill.status === filterStatus);
      filteredR = filteredR.filter(ret => ret.status === filterStatus);
    }

    if (filterMethod !== 'all') {
      filteredB = filteredB.filter(bill => bill.payment_method === filterMethod);
      filteredR = filteredR.filter(ret => ret.payment_method === filterMethod);
    }

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
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  // REFACTORED – Entire row clickable, opens Record Workspace
  const handleRowClick = (itemId) => {
    navigate(`/billing/${itemId}`);
  };

  const renderSalesTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bill #</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Amount</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredBills.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No sales found</p>
              </td>
            </tr>
          ) : (
            filteredBills.map((bill) => (
              <tr 
                key={bill.id} 
                className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(bill.id)}
                data-testid={`sales-row-${bill.id}`}
              >
                <td className="py-4 px-4">
                  <span className="font-semibold text-blue-600">{bill.bill_number}</span>
                </td>
                <td className="py-4 px-4">
                  <div className="font-medium text-gray-800">{bill.customer_name || 'Walk-in'}</div>
                  {bill.customer_mobile && (
                    <div className="text-xs text-gray-500">{bill.customer_mobile}</div>
                  )}
                </td>
                <td className="py-4 px-4 text-sm text-gray-600">
                  {new Date(bill.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="font-bold text-gray-800">₹{bill.total_amount?.toFixed(2)}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  {getStatusBadge(bill.status)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // REFACTORED – Sales Return table with entire row clickable
  const renderReturnsTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Return #</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Original Bill</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Amount</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredReturns.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-gray-500">
                <RotateCcw className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No returns found</p>
              </td>
            </tr>
          ) : (
            filteredReturns.map((ret) => (
              <tr 
                key={ret.id} 
                className="border-b hover:bg-orange-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(ret.id)}
                data-testid={`return-row-${ret.id}`}
              >
                <td className="py-4 px-4">
                  <span className="font-semibold text-orange-600">{ret.bill_number}</span>
                </td>
                <td className="py-4 px-4">
                  <div className="font-medium text-gray-800">{ret.customer_name || 'Walk-in'}</div>
                  {ret.customer_mobile && (
                    <div className="text-xs text-gray-500">{ret.customer_mobile}</div>
                  )}
                </td>
                <td className="py-4 px-4 text-sm text-gray-600">
                  {new Date(ret.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </td>
                <td className="py-4 px-4">
                  {ret.ref_invoice_id ? (
                    <span 
                      className="text-blue-600 font-medium text-sm hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        const originalBill = bills.find(b => b.id === ret.ref_invoice_id);
                        if (originalBill) {
                          navigate(`/billing/${originalBill.id}`);
                        }
                      }}
                    >
                      {bills.find(b => b.id === ret.ref_invoice_id)?.bill_number || 'View Original'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Not Linked</span>
                  )}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="font-bold text-orange-600">-₹{ret.total_amount?.toFixed(2)}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  {getStatusBadge(ret.status)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Sales & Returns</h1>
            <p className="text-sm text-gray-500">Click any row to open the record workspace</p>
          </div>
          <Button
            onClick={() => navigate('/billing/new')}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="new-sale-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Sale
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs defaultValue="sales" className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <TabsList className="bg-white border">
              <TabsTrigger value="sales" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700" data-testid="sales-tab">
                <FileText className="w-4 h-4 mr-2" />
                Sales ({filteredBills.length})
              </TabsTrigger>
              <TabsTrigger value="returns" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700" data-testid="returns-tab">
                <RotateCcw className="w-4 h-4 mr-2" />
                Returns ({filteredReturns.length})
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="search-input"
                />
              </div>
              <select
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="due">Due</option>
                <option value="draft">Draft</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <TabsContent value="sales" className="mt-0">
                {renderSalesTable()}
              </TabsContent>
              <TabsContent value="returns" className="mt-0">
                {renderReturnsTable()}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
