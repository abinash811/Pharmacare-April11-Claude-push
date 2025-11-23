import React, { useState } from 'react';
import axios from 'axios';
import { Download, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', disabled = false, className = '' }) => {
  const baseStyles = 'rounded font-medium transition-colors px-4 py-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  };
  
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export default function GSTReport() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  const fetchGSTReport = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API}/reports/gst`, {
        params: dateRange,
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to generate GST report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;
    
    // Create CSV content
    let csv = 'Type,GST Rate,Taxable Amount,CGST,SGST,IGST,Total GST\n';
    
    if (reportData.sales) {
      reportData.sales.forEach(row => {
        csv += `Sales,${row.gst_rate}%,${row.taxable_amount},${row.cgst},${row.sgst},${row.igst},${row.total_gst}\n`;
      });
    }
    
    if (reportData.purchases) {
      reportData.purchases.forEach(row => {
        csv += `Purchases,${row.gst_rate}%,${row.taxable_amount},${row.cgst},${row.sgst},${row.igst},${row.total_gst}\n`;
      });
    }
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-report-${dateRange.start_date}-to-${dateRange.end_date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Report exported successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FileText className="w-8 h-8" />
          GST / Tax Report
        </h1>
        <p className="text-gray-600 mt-1">View GST collected and paid for compliance</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          
          <Button onClick={fetchGSTReport} disabled={loading}>
            <Calendar className="w-4 h-4 mr-2 inline" />
            {loading ? 'Loading...' : 'Generate Report'}
          </Button>
        </div>
      </div>

      {/* Report Display */}
      {reportData && (
        <>
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Sales GST (Output Tax)</h2>
              <Button variant="secondary" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2 inline" />
                Export CSV
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taxable Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CGST</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">SGST</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IGST</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.sales?.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4">{row.gst_rate}%</td>
                      <td className="px-6 py-4 text-right">₹{row.taxable_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{row.cgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{row.sgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{row.igst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold">₹{row.total_gst?.toLocaleString()}</td>
                    </tr>
                  ))}
                  {reportData.sales_summary && (
                    <tr className="bg-blue-50 font-semibold">
                      <td className="px-6 py-4">Total</td>
                      <td className="px-6 py-4 text-right">₹{reportData.sales_summary.total_taxable?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.sales_summary.total_cgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.sales_summary.total_sgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.sales_summary.total_igst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.sales_summary.total_gst?.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Purchases GST (Input Tax Credit)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taxable Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CGST</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">SGST</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IGST</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.purchases?.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4">{row.gst_rate}%</td>
                      <td className="px-6 py-4 text-right">₹{row.taxable_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{row.cgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{row.sgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{row.igst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold">₹{row.total_gst?.toLocaleString()}</td>
                    </tr>
                  ))}
                  {reportData.purchases_summary && (
                    <tr className="bg-green-50 font-semibold">
                      <td className="px-6 py-4">Total</td>
                      <td className="px-6 py-4 text-right">₹{reportData.purchases_summary.total_taxable?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.purchases_summary.total_cgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.purchases_summary.total_sgst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.purchases_summary.total_igst?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">₹{reportData.purchases_summary.total_gst?.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Net GST Liability */}
          {reportData.net_liability && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-8 mt-6 text-white">
              <h3 className="text-xl font-semibold mb-4">Net GST Liability</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-blue-200 text-sm">Output Tax (Sales)</p>
                  <p className="text-3xl font-bold">₹{reportData.sales_summary?.total_gst?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Input Tax Credit (Purchases)</p>
                  <p className="text-3xl font-bold">₹{reportData.purchases_summary?.total_gst?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Net Payable</p>
                  <p className="text-3xl font-bold">₹{reportData.net_liability?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!reportData && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No report generated</p>
          <p className="text-gray-500 text-sm mt-2">Select date range and click "Generate Report"</p>
        </div>
      )}
    </div>
  );
}
