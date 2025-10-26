import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Reports() {
  const [salesReport, setSalesReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSalesReport = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/reports/sales`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalesReport(response.data);
    } catch (error) {
      toast.error('Failed to load sales report');
    }
    setLoading(false);
  };

  const handleExport = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/backup/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmacy-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  useEffect(() => {
    fetchSalesReport();
  }, []);

  return (
    <div className="p-8" data-testid="reports-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-600 mt-1">View and export reports</p>
        </div>
        <Button onClick={handleExport} data-testid="export-data-btn">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="sales" data-testid="sales-report-tab">Sales Report</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : salesReport ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card data-testid="total-bills-card">
                  <CardHeader>
                    <CardTitle>Total Bills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-gray-800" data-testid="total-bills-value">
                      {salesReport.summary.total_bills}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="total-sales-report-card">
                  <CardHeader>
                    <CardTitle>Total Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600" data-testid="total-sales-report-value">
                      ₹{salesReport.summary.total_sales.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="total-tax-card">
                  <CardHeader>
                    <CardTitle>Total GST Collected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-600" data-testid="total-tax-value">
                      ₹{salesReport.summary.total_tax.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Bills</CardTitle>
                  <CardDescription>Last 10 transactions</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="recent-bills-table">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill No.</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {salesReport.bills.slice(0, 10).map((bill) => (
                          <tr key={bill.id} className="hover:bg-gray-50" data-testid={`bill-row-${bill.id}`}>
                            <td className="px-6 py-4 font-medium text-gray-800">{bill.bill_number}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{bill.customer_name || 'Walk-in'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(bill.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-800">
                              ₹{bill.total_amount.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 capitalize">{bill.payment_method}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No data available</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
