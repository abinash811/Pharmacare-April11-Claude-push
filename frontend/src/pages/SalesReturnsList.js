import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { Plus, Printer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, DataCard, SearchInput, StatusBadge, DateRangePicker, PageSkeleton } from '../components/shared';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SalesReturnsList() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
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
    totalRefundedToday: 0
  });

  // Role permissions
  const [allowManualReturns, setAllowManualReturns] = useState(false);

  useEffect(() => {
    fetchData();
    fetchRolePermissions();
  }, [debouncedSearch]);

  // Debounce search
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      let url = `${API}/sales-returns?page_size=500`;
      if (debouncedSearch) {
        url += `&search=${encodeURIComponent(debouncedSearch)}`;
      }
      if (activeFilter !== 'all') {
        url += `&payment_type=${activeFilter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setReturns(data.data || []);
      setStats({
        returnsToday: data.stats?.returns_today || 0,
        totalRefundedToday: data.stats?.total_refunded_today || 0
      });
    } catch (error) {
      toast.error('Failed to load sales returns');
    }
    setLoading(false);
  };

  const fetchRolePermissions = async () => {
    if (!user?.role) return;
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/roles/${user.role}/permissions/returns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllowManualReturns(response.data.allow_manual_returns || user.role === 'admin');
    } catch (error) {
      // Default to admin having permission
      setAllowManualReturns(user?.role === 'admin');
    }
  };

  const handleNewReturn = () => {
    if (allowManualReturns) {
      navigate('/billing/returns/new');
    } else {
      toast.warning('Sales returns can only be created from an existing bill. Open the bill and use the Return option.', {
        duration: 5000
      });
    }
  };

  const getFilteredData = () => {
    let data = [...returns];
    
    // Date filter
    if (dateRange.start && dateRange.end) {
      data = data.filter(item => {
        const itemDate = new Date(item.return_date || item.entry_date);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
      });
    }
    
    return data;
  };

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

  const filteredData = getFilteredData();

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="sales-returns-page">
      {/* Page Header */}
      <PageHeader
        title="Sales Returns"
        subtitle={`Today -₹${stats.totalRefundedToday.toFixed(2)} · ${stats.returnsToday} returns`}
        actions={
          <Button onClick={handleNewReturn} data-testid="new-return-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
        }
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Return no., bill no., patient..."
            className="w-64"
          />

          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {['all', 'cash', 'upi', 'credit_to_account'].map((filter) => (
              <button
                key={filter}
                onClick={() => { setActiveFilter(filter); fetchData(); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeFilter === filter
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'credit_to_account' ? 'Credit' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="sales-returns-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Return No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Original Bill</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Return Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry By</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No sales returns found
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/billing/returns/${item.id}`)}
                    data-testid={`return-row-${item.return_no}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-[#4682B4]">
                        #{item.return_no}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.original_bill_no ? (
                        <span className="font-mono text-sm text-gray-700">#{item.original_bill_no}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item.patient?.name || 'Walk-in'}</div>
                      {item.patient?.phone && (
                        <div className="text-xs text-gray-500">{item.patient.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDate(item.entry_date)}</div>
                      <div className="text-xs text-gray-500">{formatTime(item.entry_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDate(item.return_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{item.created_by?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-red-600">
                        -₹{(item.net_amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.refund_method || 'cash'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-1.5 h-auto hover:bg-blue-50"
                          onClick={(e) => { e.stopPropagation(); navigate(`/billing/returns/${item.id}`); }}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-1.5 h-auto hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); toast.info('Print functionality coming soon'); }}
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
