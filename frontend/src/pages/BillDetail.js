import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Printer, User, Phone, Calendar, DollarSign, Package } from 'lucide-react';
import { toast } from 'sonner';
import ActivityTimeline from '@/components/ActivityTimeline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillDetails();
  }, [id]);

  const fetchBillDetails = async () => {
    const token = localStorage.getItem('token');
    try {
      const [billRes, paymentsRes] = await Promise.all([
        axios.get(`${API}/bills/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/payments?invoice_id=${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBill(billRes.data);
      setPayments(paymentsRes.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load bill details');
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'due':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!bill) {
    return <div className="p-8">Bill not found</div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{bill.bill_number}</h1>
            <p className="text-gray-600 mt-1">
              {bill.invoice_type === 'SALE' ? 'Sale Invoice' : 'Sales Return'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Bill Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{bill.customer_name || 'Counter Sale'}</span>
              </div>
              {bill.customer_mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{bill.customer_mobile}</span>
                </div>
              )}
              {bill.doctor_name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>Doctor: {bill.doctor_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>{formatDate(bill.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Items ({bill.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Batch</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Disc</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bill.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {item.product_name || item.medicine_name}
                          </div>
                          {item.brand && (
                            <div className="text-xs text-gray-500">{item.brand}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {item.batch_no || item.batch_number}
                        </td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">₹{item.unit_price || item.mrp}</td>
                        <td className="px-3 py-2 text-right">₹{item.discount || 0}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          ₹{(item.line_total || item.total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payments */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium capitalize">{payment.payment_method}</div>
                        {payment.reference_number && (
                          <div className="text-xs text-gray-500">Ref: {payment.reference_number}</div>
                        )}
                        <div className="text-xs text-gray-500">{formatDate(payment.created_at)}</div>
                      </div>
                      <div className="font-bold">₹{payment.amount.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          <ActivityTimeline entityType="invoice" entityId={bill.id} />
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bill.status)}`}>
                {bill.status.toUpperCase()}
              </span>
            </CardContent>
          </Card>

          {/* Bill Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>₹{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="text-red-600">-₹{bill.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST ({bill.tax_rate}%)</span>
                <span>₹{bill.tax_amount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total Amount</span>
                <span className="text-lg">₹{bill.total_amount.toFixed(2)}</span>
              </div>
              
              {bill.paid_amount !== undefined && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Paid</span>
                    <span className="text-green-600">₹{bill.paid_amount.toFixed(2)}</span>
                  </div>
                  {bill.due_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Due</span>
                      <span className="text-red-600 font-medium">₹{bill.due_amount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Cashier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Created By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div className="font-medium">{bill.cashier_name}</div>
                <div className="text-gray-500">{formatDate(bill.created_at)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
