import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Printer, Eye, Edit } from 'lucide-react';
import { PageHeader, DataCard, SearchInput, StatusBadge, DateRangePicker } from '../components/shared';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// WhatsApp icon component
const WhatsAppIcon = ({ className }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function BillingOperations() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Stats
  const [stats, setStats] = useState({
    billsToday: 0,
    parkedCount: 0,
    pendingDueCount: 0,
    totalAmountToday: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [bills]);

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
      const response = await axios.get(`${API}/bills?invoice_type=SALE&page_size=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBills(response.data.data || response.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let billsToday = 0;
    let parkedCount = 0;
    let pendingDueCount = 0;
    let totalAmountToday = 0;

    bills.forEach(bill => {
      const billDate = new Date(bill.created_at);
      billDate.setHours(0, 0, 0, 0);
      const isToday = billDate.getTime() === today.getTime();

      // Count parked/draft bills (all time) - check both status and bill_number
      const isParkedOrDraft = bill.status === 'parked' || bill.status === 'draft' || bill.bill_number?.toLowerCase().includes('draft');
      if (isParkedOrDraft) {
        parkedCount++;
      }

      // Count pending due bills (all time)
      if (bill.status === 'due') {
        pendingDueCount++;
      }

      // Count bills created today
      if (isToday) {
        billsToday++;
        // Sum amount for finalised bills today (paid status, not draft/parked)
        if (bill.status === 'paid' && !isParkedOrDraft) {
          totalAmountToday += bill.total_amount || bill.grand_total || 0;
        }
      }
    });

    setStats({
      billsToday,
      parkedCount,
      pendingDueCount,
      totalAmountToday
    });
  };

  // Filter data based on search and filter pills
  const filterData = (data) => {
    return data.filter(item => {
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.bill_number?.toLowerCase().includes(search) ||
          item.customer_name?.toLowerCase().includes(search) ||
          item.customer_mobile?.includes(search);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (dateRange.start && dateRange.end) {
        const itemDate = new Date(item.created_at);
        if (itemDate < dateRange.start || itemDate > dateRange.end) return false;
      }

      // Payment/Status filter pills
      if (activeFilter !== 'all') {
        if (activeFilter === 'cash' && item.payment_method?.toLowerCase() !== 'cash') return false;
        if (activeFilter === 'upi' && item.payment_method?.toLowerCase() !== 'upi') return false;
        if (activeFilter === 'due' && item.status !== 'due') return false;
        if (activeFilter === 'parked' && item.status !== 'parked') return false;
      }

      return true;
    });
  };

  const filteredBills = filterData(bills);

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

  const handlePrint = (e, bill) => {
    e.stopPropagation();
    toast.info(`Printing bill #${bill.bill_number}...`);
    // TODO: Implement actual print functionality
  };

  const handleWhatsApp = (e, bill) => {
    e.stopPropagation();
    if (bill.customer_mobile) {
      const message = `Your bill #${bill.bill_number} from PharmaCare. Total: ₹${(bill.total_amount || 0).toFixed(2)}`;
      window.open(`https://wa.me/91${bill.customer_mobile}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      toast.error('No mobile number available for this customer');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="billing-operations-page">
      {/* Page Header */}
      <PageHeader
        title="Sales & Billing"
        subtitle={`Today ₹${stats.totalAmountToday.toFixed(2)} · ${stats.billsToday} bills`}
        actions={
          <>
            <Button 
              variant="outline"
              onClick={() => navigate('/billing/returns')}
              data-testid="sales-return-btn"
            >
              Sales Returns
            </Button>
            <Button 
              onClick={() => navigate('/billing/new')}
              data-testid="new-bill-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Bill
            </Button>
          </>
        }
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Bill no., patient..."
            className="w-64"
          />

          {/* Date range picker */}
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {['all', 'cash', 'upi', 'due', 'parked'].map((filter) => (
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

        {/* Stats Summary */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Parked <span className="font-bold text-amber-600">{stats.parkedCount}</span></span>
          <span className="text-gray-300">·</span>
          <span>Due <span className="font-bold text-red-600">{stats.pendingDueCount}</span></span>
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="billing-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Bill No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Bill Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Billed By</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading...
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    No bills found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const isParked = bill.status === 'parked' || bill.status === 'draft' || bill.bill_number?.toLowerCase().includes('draft');
                  const isDue = bill.status === 'due';
                  
                  return (
                    <tr 
                      key={bill.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                      data-testid={`bill-row-${bill.id}`}
                    >
                      {/* Bill number */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isParked ? (
                            <StatusBadge status="parked" />
                          ) : (
                            <span className="font-mono text-sm font-semibold text-blue-600">
                              #{bill.bill_number?.replace(/^#/, '') || bill.id?.slice(-4)}
                            </span>
                          )}
                          {bill.returns && bill.returns.length > 0 && (
                            <StatusBadge status="adjusted" label="Ret" />
                          )}
                        </div>
                      </td>
                      
                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{bill.customer_name || 'Counter Sale'}</div>
                        {bill.customer_mobile && (
                          <div className="text-xs text-gray-500">{bill.customer_mobile}</div>
                        )}
                      </td>
                      
                      {/* Entry date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(bill.created_at)}</div>
                        <div className="text-xs text-gray-500">{formatTime(bill.created_at)}</div>
                      </td>
                      
                      {/* Bill date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(bill.created_at)}</div>
                      </td>
                      
                      {/* Billed by */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{bill.cashier_name || 'Owner'}</div>
                      </td>
                      
                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isDue ? 'text-red-600' : 'text-gray-800'}`}>
                          ₹{(bill.total_amount || bill.grand_total || 0).toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Payment badge */}
                      <td className="px-4 py-3 text-center">
                        {isParked ? (
                          <StatusBadge status="parked" />
                        ) : isDue ? (
                          <StatusBadge status="due" />
                        ) : (
                          <StatusBadge status={bill.payment_method || 'cash'} />
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-1.5 h-auto hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); navigate(`/billing/${bill.id}`); }}
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-1.5 h-auto hover:bg-gray-100"
                            onClick={(e) => handlePrint(e, bill)}
                            title="Print"
                          >
                            <Printer className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-1.5 h-auto hover:bg-green-50"
                            onClick={(e) => handleWhatsApp(e, bill)}
                            title="Send via WhatsApp"
                          >
                            <WhatsAppIcon className="w-4 h-4 text-green-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
