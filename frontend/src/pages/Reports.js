import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, Download, AlertCircle, Clock, TrendingUp, Package, 
  Calendar, Filter, RefreshCw, BarChart3, AlertTriangle, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

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

  const fetchReport = async (reportType) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      let endpoint = '';
      let params = {};
      
      switch (reportType) {
        case 'sales':
          endpoint = '/api/reports/sales-summary';
          params = { from_date: dateRange.from, to_date: dateRange.to };
          break;
        case 'low-stock':
          endpoint = '/api/reports/low-stock';
          break;
        case 'expiry':
          endpoint = '/api/reports/expiry';
          params = { days: expiryDays };
          break;
        default:
          endpoint = '/api/reports/sales-summary';
      }
      
      const response = await axios.get(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to load report');
      console.error('Report error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport]);

  const handleExportCSV = () => {
    if (!reportData?.data) return;
    
    let csvContent = '';
    const data = reportData.data;
    
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    // Get headers from first row
    const headers = Object.keys(data[0]);
    csvContent += headers.join(',') + '\n';
    
    // Add data rows
    data.forEach(row => {
      const values = headers.map(h => {
        const val = row[h];
        // Escape commas and quotes
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvContent += values.join(',') + '\n';
    });
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport}-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Report exported successfully');
  };

  const formatCurrency = (value) => {
    return `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-500">Generate and export business reports</p>
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeReport === 'sales' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setActiveReport('sales')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold">Sales Report</p>
              <p className="text-xs text-gray-500">Daily & monthly sales</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeReport === 'low-stock' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setActiveReport('low-stock')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold">Low Stock</p>
              <p className="text-xs text-gray-500">Items to reorder</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeReport === 'expiry' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setActiveReport('expiry')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Clock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold">Expiry Report</p>
              <p className="text-xs text-gray-500">Expiring soon items</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeReport === 'inventory' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setActiveReport('inventory')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold">Stock Report</p>
              <p className="text-xs text-gray-500">Current inventory</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {activeReport === 'sales' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">From:</label>
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">To:</label>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="w-40"
                  />
                </div>
              </>
            )}

            {activeReport === 'expiry' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Expiring in:</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>6 months</option>
                </select>
              </div>
            )}

            <Button onClick={() => fetchReport(activeReport)} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button onClick={handleExportCSV} variant="outline" disabled={!reportData?.data?.length}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeReport === 'sales' && <TrendingUp className="w-5 h-5 text-blue-600" />}
              {activeReport === 'low-stock' && <AlertCircle className="w-5 h-5 text-orange-600" />}
              {activeReport === 'expiry' && <Clock className="w-5 h-5 text-red-600" />}
              {activeReport === 'inventory' && <Package className="w-5 h-5 text-green-600" />}
              {activeReport === 'sales' && 'Sales Report'}
              {activeReport === 'low-stock' && 'Low Stock Report'}
              {activeReport === 'expiry' && 'Expiry Report'}
              {activeReport === 'inventory' && 'Stock Report'}
            </CardTitle>
            <CardDescription>
              {reportData?.summary && (
                <div className="flex gap-6 mt-2">
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
            {/* Sales Report */}
            {activeReport === 'sales' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Bill #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Customer</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Items</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Payment</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>No sales data for selected period</p>
                        </td>
                      </tr>
                    ) : (
                      reportData?.data?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-blue-600">{row.bill_number}</td>
                          <td className="px-4 py-3 text-sm">{row.date}</td>
                          <td className="px-4 py-3">{row.customer_name || 'Walk-in'}</td>
                          <td className="px-4 py-3 text-center">{row.items_count}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">{row.payment_method}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(row.total_amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Low Stock Report */}
            {activeReport === 'low-stock' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Product</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Current Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Reorder Level</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Shortage</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-12 text-center text-gray-500">
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>All items have adequate stock levels</p>
                        </td>
                      </tr>
                    ) : (
                      reportData?.data?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.product_name}</div>
                            <div className="text-xs text-gray-500">SKU: {row.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-red-600">
                            {row.current_stock}
                          </td>
                          <td className="px-4 py-3 text-center">{row.reorder_level}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                              -{row.shortage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.current_stock === 0 ? (
                              <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">Out of Stock</span>
                            ) : (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">Low Stock</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expiry Report */}
            {activeReport === 'expiry' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Batch</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Expiry Date</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Days Left</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>No items expiring within {expiryDays} days</p>
                        </td>
                      </tr>
                    ) : (
                      reportData?.data?.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50 ${row.days_to_expiry < 0 ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.product_name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{row.batch_no}</span>
                          </td>
                          <td className="px-4 py-3 text-center">{row.qty}</td>
                          <td className="px-4 py-3 text-center">{row.expiry_date}</td>
                          <td className="px-4 py-3 text-center">
                            {row.days_to_expiry < 0 ? (
                              <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                                Expired
                              </span>
                            ) : row.days_to_expiry <= 7 ? (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                {row.days_to_expiry} days
                              </span>
                            ) : row.days_to_expiry <= 30 ? (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                {row.days_to_expiry} days
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                {row.days_to_expiry} days
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
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
              <div className="p-6 text-center text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Full inventory report available in Inventory section</p>
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
