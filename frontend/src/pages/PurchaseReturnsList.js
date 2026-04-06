import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Printer, Eye, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, DataCard, SearchInput, StatusBadge, DateRangePicker, TableSkeleton } from '../components/shared';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseReturnsList() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Stats
  const [stats, setStats] = useState({
    returnsToday: 0,
    totalReturnedToday: 0
  });

  useEffect(() => {
    fetchReturns();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [returns]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const fetchReturns = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchase-returns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReturns(response.data || []);
    } catch (error) {
      toast.error('Failed to load purchase returns');
    }
    setLoading(false);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let returnsToday = 0;
    let totalReturnedToday = 0;

    returns.forEach(ret => {
      const retDate = new Date(ret.return_date || ret.created_at);
      retDate.setHours(0, 0, 0, 0);
      const isToday = retDate.getTime() === today.getTime();

      if (isToday) {
        returnsToday++;
        totalReturnedToday += ret.total_value || 0;
      }
    });

    setStats({ returnsToday, totalReturnedToday });
  };

  const filterData = (data) => {
    return data.filter(item => {
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.return_number?.toLowerCase().includes(search) ||
          item.purchase_number?.toLowerCase().includes(search) ||
          item.supplier_name?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (dateRange.start && dateRange.end) {
        const itemDate = new Date(item.return_date || item.created_at);
        if (itemDate < dateRange.start || itemDate > dateRange.end) return false;
      }

      if (activeFilter !== 'all') {
        if (activeFilter === 'credit' && item.payment_type !== 'credit') return false;
        if (activeFilter === 'cash' && item.payment_type !== 'cash') return false;
        if (activeFilter === 'upi' && item.payment_type !== 'upi') return false;
      }

      return true;
    });
  };

  const filteredReturns = filterData(returns);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handlePrint = (e, ret) => {
    e.stopPropagation();
    toast.info(`Printing return #${ret.return_number}...`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="purchase-returns-page">
      {/* Page Header */}
      <PageHeader
        title="Purchase Returns"
        subtitle={`Today ₹${stats.totalReturnedToday.toFixed(2)} · ${stats.returnsToday} returns`}
        actions={
          <>
            <Button 
              variant="outline"
              onClick={() => navigate('/purchases')}
              data-testid="back-to-purchases-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Purchases
            </Button>
            <Button 
              onClick={() => toast.info('Purchase returns can only be created from a confirmed purchase. Go to a purchase → More → Purchase Return')}
              data-testid="new-return-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Purchase Return
            </Button>
          </>
        }
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Return no., supplier..."
            className="w-64"
          />

          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {['all', 'credit', 'cash', 'upi'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                  activeFilter === filter
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid={`filter-${filter}`}
              >
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="purchase-returns-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Return No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Original Purchase</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Return Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry By</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-0">
                    <TableSkeleton rows={6} columns={8} />
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No purchase returns found
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr 
                    key={ret.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/purchases/returns/${ret.id}`)}
                    data-testid={`return-row-${ret.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-[#4682B4]">
                        {ret.return_number}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-700">
                        {ret.purchase_number || '—'}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{ret.supplier_name || '—'}</div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDate(ret.created_at)}</div>
                      <div className="text-xs text-gray-500">{formatTime(ret.created_at)}</div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDate(ret.return_date)}</div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{ret.billed_by || 'Owner'}</div>
                    </td>
                    
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-red-600">
                        -₹{(ret.total_value || 0).toFixed(2)}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={ret.payment_type || 'credit'} />
                    </td>
                    
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-1.5 h-auto hover:bg-blue-50"
                          onClick={(e) => { e.stopPropagation(); navigate(`/purchases/returns/${ret.id}`); }}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-1.5 h-auto hover:bg-gray-100"
                          onClick={(e) => handlePrint(e, ret)}
                        >
                          <Printer className="w-4 h-4 text-gray-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
