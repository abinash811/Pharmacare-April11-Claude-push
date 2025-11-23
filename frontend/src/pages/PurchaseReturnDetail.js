import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, XCircle, Package, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    success: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

export default function PurchaseReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchaseReturn, setPurchaseReturn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchReturnDetails();
  }, [id]);

  const fetchReturnDetails = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchase-returns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchaseReturn(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load return details');
      setLoading(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!window.confirm('Confirm this purchase return? This will deduct stock and create a supplier credit note. This action cannot be undone.')) {
      return;
    }

    setConfirming(true);
    const token = localStorage.getItem('token');
    
    try {
      await axios.post(`${API}/purchase-returns/${id}/confirm`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Purchase return confirmed successfully!');
      fetchReturnDetails(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm return');
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-GB');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading return details...</p>
        </div>
      </div>
    );
  }

  if (!purchaseReturn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-gray-800">Purchase return not found</p>
          <Button onClick={() => navigate('/purchase-returns')} className="mt-4">
            Back to Returns
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/purchase-returns')} className="p-2 hover:bg-gray-100 rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Purchase Return Details</h1>
              <p className="text-sm text-gray-600">Return ID: {purchaseReturn.id}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {purchaseReturn.status === 'draft' && (
              <Button
                variant="success"
                onClick={handleConfirmReturn}
                disabled={confirming}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {confirming ? 'Confirming...' : 'Confirm Return'}
              </Button>
            )}
            
            {purchaseReturn.status === 'confirmed' && (
              <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Confirmed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Return Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Return Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Return Date</p>
              <p className="font-medium">{formatDate(purchaseReturn.return_date)}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Purchase ID</p>
              <button
                onClick={() => navigate(`/purchases/${purchaseReturn.purchase_id}`)}
                className="font-medium text-blue-600 hover:underline"
              >
                {purchaseReturn.purchase_id}
              </button>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Supplier</p>
              <p className="font-medium">{purchaseReturn.supplier_name || '-'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Supplier Invoice No.</p>
              <p className="font-medium">{purchaseReturn.supplier_invoice_no || '-'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Return Reason</p>
              <p className="font-medium">{purchaseReturn.reason || '-'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                purchaseReturn.status === 'confirmed' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {purchaseReturn.status === 'confirmed' ? 'Confirmed' : 'Draft'}
              </span>
            </div>
            
            {purchaseReturn.confirmed_at && (
              <div>
                <p className="text-sm text-gray-600">Confirmed At</p>
                <p className="font-medium">{formatDateTime(purchaseReturn.confirmed_at)}</p>
              </div>
            )}
            
            {purchaseReturn.confirmed_by && (
              <div>
                <p className="text-sm text-gray-600">Confirmed By</p>
                <p className="font-medium">{purchaseReturn.confirmed_by}</p>
              </div>
            )}
            
            {purchaseReturn.notes && (
              <div className="md:col-span-3">
                <p className="text-sm text-gray-600">Notes</p>
                <p className="font-medium">{purchaseReturn.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Return Items */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Returned Items
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Batch No.</th>
                  <th className="px-4 py-3 text-right">Qty (Units)</th>
                  <th className="px-4 py-3 text-right">Cost/Unit</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchaseReturn.items?.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-gray-500">{item.product_sku}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.batch_no || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.qty_units}</td>
                    <td className="px-4 py-3 text-right">₹{item.cost_price_per_unit?.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                        {item.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">₹{item.line_total?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="max-w-md ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">₹{purchaseReturn.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">₹{purchaseReturn.tax_value?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total Return Amount:</span>
              <span>₹{purchaseReturn.total_amount?.toLocaleString() || '0'}</span>
            </div>
          </div>

          {purchaseReturn.status === 'draft' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">Draft Return</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This return is in draft status. Click "Confirm Return" to deduct stock and create a supplier credit note.
                  </p>
                </div>
              </div>
            </div>
          )}

          {purchaseReturn.status === 'confirmed' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">Return Confirmed</p>
                  <p className="text-sm text-green-700 mt-1">
                    Stock has been deducted and a supplier credit note has been created. Confirmed at {formatDateTime(purchaseReturn.confirmed_at)}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
