import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  FileText, Download, AlertCircle, Clock, TrendingUp, Package, 
  RefreshCw, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, formatReportForExcel } from '@/utils/excelExport';
import { fetchWithCache, invalidateCache } from '@/utils/cache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Reports() {
  const [activeReport, setActiveReport] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [expiryDays, setExpiryDays] = useState(30);

  const fetchReport = async (reportType, forceRefresh = false) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      let endpoint = '';
      let params = {};
      let cacheKey = '';
      
      switch (reportType) {
        case 'sales':
          endpoint = '/api/reports/sales-summary';
          params = { from_date: dateRange.from, to_date: dateRange.to };
          cacheKey = `report_sales_${dateRange.from}_${dateRange.to}`;
          break;
        case 'low-stock':
          endpoint = '/api/reports/low-stock';
          cacheKey = 'report_low_stock';
          break;
        case 'expiry':
          endpoint = '/api/reports/expiry';
          params = { days: expiryDays };
          cacheKey = `report_expiry_${expiryDays}`;
          break;
        default:
          endpoint = '/api/reports/sales-summary';
          cacheKey = 'report_default';
      }
      
      const fetchFn = async () => {
        const response = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
          params
        });
        return response.data;
      };

      // Use cache for reports (1 minute TTL for reports)
      const data = await fetchWithCache(cacheKey, fetchFn, forceRefresh);
      setReportData(data);
    } catch (error) {
      toast.error('Failed to load report');
      console.error('Report error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport]);

  const handleRefresh = () => {
    invalidateCache(`report_${activeReport}`);
    fetchReport(activeReport, true);
  };

  const handleExportCSV = () => {
    if (!reportData?.data) return;
    
    let csvContent = '';
    const data = reportData.data;
    
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    csvContent += headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvContent += values.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport}-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Report exported to CSV');
  };

  const handleExportExcel = () => {
    if (!reportData?.data || reportData.data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const formattedData = formatReportForExcel(activeReport, reportData);
      const reportNames = {
        'sales': 'Sales_Report',
        'low-stock': 'Low_Stock_Report',
        'expiry': 'Expiry_Report',
        'inventory': 'Inventory_Report'
      };
      
      exportToExcel(formattedData, reportNames[activeReport] || 'Report', {
        sheetName: activeReport.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
      });
      
      toast.success('Report exported to Excel');
    } catch (error) {
      toast.error('Failed to export Excel');
      console.error('Excel export error:', error);
    }
  };

  const formatCurrency = (value) => {
    return `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const reportCards = [
    { id: 'sales', icon: TrendingUp, color: 'blue', title: 'Sales Report', desc: 'Daily & monthly sales' },
    { id: 'low-stock', icon: AlertCircle, color: 'orange', title: 'Low Stock', desc: 'Items to reorder' },
    { id: 'expiry', icon: Clock, color: 'red', title: 'Expiry Report', desc: 'Expiring soon items' },
    { id: 'inventory', icon: Package, color: 'green', title: 'Stock Report', desc: 'Current inventory' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Header - Responsive */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reports</h1>
        <p className="text-xs sm:text-sm text-gray-500">Generate and export business reports</p>
      </div>

      {/* Report Categories - Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {reportCards.map(({ id, icon: Icon, color, title, desc }) => (
          <Card 
            key={id}
            className={`cursor-pointer transition-all hover:shadow-md ${activeReport === id ? `ring-2 ring-${color}-500` : ''}`}
            onClick={() => setActiveReport(id)}
            data-testid={`report-card-${id}`}
          >
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 bg-${color}-100 rounded-lg flex-shrink-0`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${color}-600`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate">{title}</p>
                <p className="text-xs text-gray-500 hidden sm:block">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters - Responsive */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
            {activeReport === 'sales' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">From:</label>
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="w-full sm:w-36"
                    data-testid="date-from"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">To:</label>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="w-full sm:w-36"
                    data-testid="date-to"
                  />
                </div>
              </div>
            )}

            {activeReport === 'expiry' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-sm font-medium whitespace-nowrap">Expiring in:</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                  className="flex-1 sm:flex-none px-3 py-2 border rounded-lg text-sm"
                  data-testid="expiry-days"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>6 months</option>
                </select>
              </div>
            )}

            {/* Action Buttons - Stack on mobile */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
              <Button onClick={handleRefresh} variant="outline" size="sm" className="flex-1 sm:flex-none">
                <RefreshCw className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Button 
                onClick={handleExportCSV} 
                variant="outline" 
                size="sm"
                disabled={!reportData?.data?.length}
                className="flex-1 sm:flex-none"
                data-testid="export-csv-btn"
              >
                <Download className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">CSV</span>
              </Button>

              <Button 
                onClick={handleExportExcel} 
                variant="outline" 
                size="sm"
                disabled={!reportData?.data?.length}
                className="flex-1 sm:flex-none"
                data-testid="export-excel-btn"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              {activeReport === 'sales' && <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />}
              {activeReport === 'low-stock' && <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />}
              {activeReport === 'expiry' && <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />}
              {activeReport === 'inventory' && <Package className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />}
              {activeReport === 'sales' && 'Sales Report'}
              {activeReport === 'low-stock' && 'Low Stock Report'}
              {activeReport === 'expiry' && 'Expiry Report'}
              {activeReport === 'inventory' && 'Stock Report'}
            </CardTitle>
            <CardDescription>
              {reportData?.summary && (
                <div className="flex flex-wrap gap-3 sm:gap-6 mt-2 text-xs sm:text-sm">
                  {reportData.summary.total_items !== undefined && (
                    <span>Total Items: <strong>{reportData.summary.total_items}</strong></span>
                  )}
                  {reportData.summary.total_value !== undefined && (
                    <span>Total Value: <strong>{formatCurrency(reportData.summary.total_value)}</strong></span>
                  )}
                  {reportData.summary.total_sales !== undefined && (
                    <span>Total Sales: <strong>{formatCurrency(reportData.summary.total_sales)}</strong></span>
                  )}
                  {reportData.summary.total_bills !== undefined && (
                    <span>Total Bills: <strong>{reportData.summary.total_bills}</strong></span>
                  )}
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Sales Report - Responsive Table */}
            {activeReport === 'sales' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">Bill #</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 hidden sm:table-cell">Date</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">Customer</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600 hidden md:table-cell">Items</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600 hidden lg:table-cell">Payment</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 sm:py-12 text-center text-gray-500">
                          <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No sales data for selected period</p>
                        </td>
                      </tr>
                    ) : (
                      reportData?.data?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-blue-600 text-xs sm:text-sm">{row.bill_number}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm hidden sm:table-cell">{row.date}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{row.customer_name || 'Walk-in'}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm hidden md:table-cell">{row.items_count}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center hidden lg:table-cell">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">{row.payment_method || '-'}</span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-xs sm:text-sm">{formatCurrency(row.total_amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Low Stock Report - Responsive */}
            {activeReport === 'low-stock' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">Product</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600">Stock</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600 hidden sm:table-cell">Reorder</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600 hidden md:table-cell">Shortage</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 sm:py-12 text-center text-gray-500">
                          <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">All items have adequate stock</p>
                        </td>
                      </tr>
                    ) : (
                      reportData?.data?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{row.product_name}</div>
                            <div className="text-xs text-gray-500 hidden sm:block">SKU: {row.sku}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center font-semibold text-red-600 text-xs sm:text-sm">
                            {row.current_stock}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm hidden sm:table-cell">{row.reorder_level}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center hidden md:table-cell">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                              -{row.shortage}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            {row.current_stock === 0 ? (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-500 text-white rounded-full text-xs">Out</span>
                            ) : (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-orange-100 text-orange-700 rounded-full text-xs">Low</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expiry Report - Responsive */}
            {activeReport === 'expiry' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">Product</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 hidden sm:table-cell">Batch</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600 hidden md:table-cell">Stock</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600">Expiry</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-600">Days</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-gray-600 hidden lg:table-cell">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 sm:py-12 text-center text-gray-500">
                          <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No items expiring within {expiryDays} days</p>
                        </td>
                      </tr>
                    ) : (
                      reportData?.data?.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50 ${row.days_to_expiry < 0 ? 'bg-red-50' : ''}`}>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <div className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{row.product_name}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{row.batch_no}</span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm hidden md:table-cell">{row.qty}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm">{row.expiry_date}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            {row.days_to_expiry < 0 ? (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                                Exp
                              </span>
                            ) : row.days_to_expiry <= 7 ? (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                {row.days_to_expiry}d
                              </span>
                            ) : row.days_to_expiry <= 30 ? (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                {row.days_to_expiry}d
                              </span>
                            ) : (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                {row.days_to_expiry}d
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-medium text-xs sm:text-sm hidden lg:table-cell">
                            {formatCurrency(row.stock_value)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inventory Report */}
            {activeReport === 'inventory' && (
              <div className="p-4 sm:p-6 text-center text-gray-500">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base">Full inventory report available in Inventory section</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/inventory-v2'}>
                  Go to Inventory
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
