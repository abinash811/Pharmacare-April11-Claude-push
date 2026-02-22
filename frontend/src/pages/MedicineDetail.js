import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Edit2, Bell, Clock, Package, Percent, Hash, CreditCard, 
  Calendar, FileText, ChevronRight, Trash2, QrCode, Check,
  ArrowLeft, Plus, ShoppingCart, RotateCcw, TrendingUp, TrendingDown
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MedicineDetail() {
  const { sku } = useParams();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('batches');
  const [hideZeroQty, setHideZeroQty] = useState(true);
  const [selectedBatches, setSelectedBatches] = useState(new Set());
  
  // Transaction data
  const [transactions, setTransactions] = useState({
    sales: [],
    purchases: [],
    sales_returns: [],
    purchase_returns: []
  });
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Ledger / Movement data
  const [movements, setMovements] = useState([]);

  useEffect(() => {
    if (sku) {
      fetchProductDetails();
    }
  }, [sku]);

  useEffect(() => {
    if (product) {
      fetchBatches();
    }
  }, [product, hideZeroQty]);

  const fetchProductDetails = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      // Search for product by SKU
      const response = await axios.get(`${API}/products?search=${encodeURIComponent(sku)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const products = response.data.items || response.data || [];
      const foundProduct = products.find(p => p.sku === sku);
      
      if (foundProduct) {
        setProduct(foundProduct);
      } else {
        toast.error('Product not found');
        navigate('/inventory');
      }
    } catch (error) {
      toast.error('Failed to load product details');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock/batches?product_sku=${sku}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let batchData = response.data || [];
      if (hideZeroQty) {
        batchData = batchData.filter(b => b.qty_on_hand > 0);
      }
      setBatches(batchData);
    } catch (error) {
      console.error('Failed to load batches');
    }
  };

  const fetchTransactions = async () => {
    if (transactionsLoading) return;
    setTransactionsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API}/products/${sku}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions({
        sales: response.data.sales || [],
        purchases: response.data.purchases || [],
        sales_returns: response.data.sales_returns || [],
        purchase_returns: response.data.purchase_returns || []
      });
    } catch (error) {
      console.error('Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchMovements = async () => {
    const token = localStorage.getItem('token');
    try {
      // Fetch movements for all batches of this product
      const allMovements = [];
      for (const batch of batches) {
        const response = await axios.get(`${API}/stock-movements?batch_id=${batch.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        allMovements.push(...(response.data || []));
      }
      setMovements(allMovements.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at)));
    } catch (error) {
      console.error('Failed to load movements');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'ledger' && movements.length === 0) {
      fetchMovements();
    }
    // Fetch transactions when switching to any transaction tab
    if (['purchases', 'pur_return', 'sales', 'sales_return'].includes(tab) && transactions.sales.length === 0 && transactions.purchases.length === 0) {
      fetchTransactions();
    }
  };

  const handleSelectBatch = (batchId, checked) => {
    const newSelected = new Set(selectedBatches);
    if (checked) {
      newSelected.add(batchId);
    } else {
      newSelected.delete(batchId);
    }
    setSelectedBatches(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedBatches(new Set(batches.map(b => b.id)));
    } else {
      setSelectedBatches(new Set());
    }
  };

  const handleDeleteBatches = async () => {
    if (selectedBatches.size === 0) {
      toast.error('No batches selected');
      return;
    }
    
    const token = localStorage.getItem('token');
    let deleted = 0;
    let errors = 0;
    
    for (const batchId of selectedBatches) {
      try {
        await axios.delete(`${API}/stock/batches/${batchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        deleted++;
      } catch (error) {
        errors++;
      }
    }
    
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} batch(es)`);
      setSelectedBatches(new Set());
      fetchBatches();
    }
    if (errors > 0) {
      toast.error(`Failed to delete ${errors} batch(es) - they may have stock`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '–';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  };

  const formatDateFull = (dateStr) => {
    if (!dateStr) return '–';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 90;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const calculateMargin = (mrp, costPrice) => {
    if (!mrp || !costPrice || costPrice === 0) return '0.00';
    const margin = ((mrp - costPrice) / mrp) * 100;
    return margin.toFixed(2);
  };

  const totalStock = batches.reduce((sum, b) => sum + (b.qty_on_hand || 0), 0);
  const totalUnits = totalStock * (product?.units_per_pack || 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#00CED1] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const tabs = [
    { id: 'batches', label: 'Batches' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'pur_return', label: 'Pur. Return' },
    { id: 'sales', label: 'Sales' },
    { id: 'sales_return', label: 'Sales Return' },
    { id: 'ledger', label: 'Ledger' }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-4">
            <Link to="/inventory" className="text-[#00CED1] hover:underline font-medium">
              INVENTORY
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-[#00CED1] font-medium uppercase">
              {product.category || 'GENERAL'}
            </span>
          </div>

          {/* Product Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {product.name}
                </h1>
                <p className="text-gray-500">
                  {product.manufacturer || product.brand || '–'} • {product.pack_info || `${product.units_per_pack || 1} units/pack`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/inventory/edit/${sku}`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#00CED1] text-white font-medium rounded-lg hover:bg-[#00B5B8] transition-colors"
                data-testid="edit-product-btn"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <Clock className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-6 gap-4 mt-6">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Percent className="w-3.5 h-3.5" />
                <span>GST</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{product.gst_percent || 0}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Package className="w-3.5 h-3.5" />
                <span>STOCK</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{totalStock} ({totalUnits})</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Hash className="w-3.5 h-3.5" />
                <span>HSN</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{product.hsn_code || '–'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span>MRP</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">₹{product.default_mrp_per_unit || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>SCHEDULE</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{product.schedule || 'Non-Restricted'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span>COMPOSITION</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 truncate" title={product.composition}>
                {product.composition || product.generic_name || '–'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex items-center gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#00CED1] text-[#00CED1]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'batches' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {/* Batch Actions Bar */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  hideZeroQty ? 'bg-[#00CED1] border-[#00CED1]' : 'border-gray-300'
                }`}>
                  {hideZeroQty && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={hideZeroQty}
                  onChange={(e) => setHideZeroQty(e.target.checked)}
                  className="sr-only"
                  data-testid="hide-zero-qty"
                />
                <span className="text-sm text-gray-700">Hide Zero quantity</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteBatches}
                  disabled={selectedBatches.size === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="delete-batches-btn"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Batches
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#00CED1] text-white font-medium rounded-lg hover:bg-[#00B5B8] transition-colors"
                  data-testid="print-qr-btn"
                >
                  <QrCode className="w-4 h-4" />
                  Print QR
                </button>
              </div>
            </div>

            {/* Batches Table */}
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="batches-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedBatches.size === batches.length && batches.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#00CED1] focus:ring-[#00CED1]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch ID</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Exp. Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">MRP</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Prev. MRP</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">PTR</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Disc. (%)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">LP</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Margin%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                        No batches found
                      </td>
                    </tr>
                  ) : (
                    batches.map(batch => {
                      const expired = isExpired(batch.expiry_date);
                      const expiringSoon = isExpiringSoon(batch.expiry_date);
                      const qtyUnits = batch.qty_on_hand * (product.units_per_pack || 1);
                      const mrp = batch.mrp_per_unit || batch.mrp || product.default_mrp_per_unit || 0;
                      const costPrice = batch.cost_price_per_unit || batch.cost_price || 0;
                      const margin = calculateMargin(mrp, costPrice);
                      const lp = costPrice; // Landing Price = Cost Price
                      const ptr = costPrice * 1.1; // PTR typically 10% above cost
                      
                      return (
                        <tr 
                          key={batch.id} 
                          className={`hover:bg-gray-50 ${expired ? 'bg-red-50' : expiringSoon ? 'bg-orange-50' : ''}`}
                          data-testid={`batch-row-${batch.id}`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedBatches.has(batch.id)}
                              onChange={(e) => handleSelectBatch(batch.id, e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-[#00CED1] focus:ring-[#00CED1]"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-medium text-gray-900">{batch.batch_no || '–'}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="text-gray-900">{batch.qty_on_hand}</span>
                            <span className="text-gray-500 text-sm ml-1">({qtyUnits})</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {expired ? (
                              <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                {formatDate(batch.expiry_date)}
                              </span>
                            ) : expiringSoon ? (
                              <span className="inline-flex items-center px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                {formatDate(batch.expiry_date)}
                              </span>
                            ) : (
                              <span className="text-gray-700">{formatDate(batch.expiry_date)}</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-gray-900">
                            ₹{mrp.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right text-gray-400 line-through">
                            ₹{(mrp * 1.05).toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right text-gray-700">
                            ₹{ptr.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-center text-gray-700">
                            {batch.discount_percent || 0}
                          </td>
                          <td className="px-4 py-4 text-right text-gray-700">
                            ₹{lp.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-[#00CED1] font-medium">{margin}%</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Active
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Nearing Expiry (3m)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Expired
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Stock Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="ledger-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty Change</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                        No stock movements found
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(movement.performed_at).toLocaleString('en-GB')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            movement.movement_type === 'purchase' ? 'bg-green-100 text-green-700' :
                            movement.movement_type === 'sale' ? 'bg-blue-100 text-blue-700' :
                            movement.movement_type === 'adjustment' ? 'bg-orange-100 text-orange-700' :
                            movement.movement_type === 'opening_stock' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {movement.movement_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{movement.batch_no || '–'}</td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${
                          movement.qty_delta_units > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.qty_delta_units > 0 ? '+' : ''}{movement.qty_delta_units}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{movement.reason || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{movement.ref_id || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{movement.performed_by || '–'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Purchase History</h3>
              </div>
              <span className="text-sm text-gray-500">{transactions.purchases.length} records</span>
            </div>
            {transactionsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-[#00CED1] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading transactions...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="purchases-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Purchase #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">MRP</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.purchases.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                          No purchase records found for this medicine
                        </td>
                      </tr>
                    ) : (
                      transactions.purchases.map((txn, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-[#00CED1]">{txn.purchase_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDateFull(txn.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{txn.supplier_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{txn.supplier_invoice}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{txn.batch_no}</td>
                          <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">{txn.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">₹{txn.cost_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">₹{txn.mrp?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">₹{txn.line_total?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              txn.status === 'received' ? 'bg-green-100 text-green-700' :
                              txn.status === 'partially_received' ? 'bg-yellow-100 text-yellow-700' :
                              txn.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {txn.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Purchase Returns Tab */}
        {activeTab === 'pur_return' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Purchase Returns</h3>
              </div>
              <span className="text-sm text-gray-500">{transactions.purchase_returns.length} records</span>
            </div>
            {transactionsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-[#00CED1] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading transactions...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="purchase-returns-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Return #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Original Purchase</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.purchase_returns.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                          No purchase returns found for this medicine
                        </td>
                      </tr>
                    ) : (
                      transactions.purchase_returns.map((txn, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-orange-600">{txn.return_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDateFull(txn.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{txn.supplier_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{txn.original_purchase}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{txn.batch_no}</td>
                          <td className="px-4 py-3 text-sm text-center font-medium text-red-600">-{txn.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{txn.reason}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">₹{txn.line_total?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              txn.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              txn.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {txn.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Sales History</h3>
              </div>
              <span className="text-sm text-gray-500">{transactions.sales.length} records</span>
            </div>
            {transactionsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-[#00CED1] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading transactions...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="sales-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bill #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.sales.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                          No sales records found for this medicine
                        </td>
                      </tr>
                    ) : (
                      transactions.sales.map((txn, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-blue-600">{txn.bill_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDateFull(txn.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{txn.customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{txn.batch_no}</td>
                          <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">{txn.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">₹{txn.unit_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">{txn.discount > 0 ? `-₹${txn.discount.toFixed(2)}` : '–'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">₹{txn.line_total?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              txn.status === 'paid' ? 'bg-green-100 text-green-700' :
                              txn.status === 'due' ? 'bg-red-100 text-red-700' :
                              txn.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {txn.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sales Returns Tab */}
        {activeTab === 'sales_return' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-gray-900">Sales Returns</h3>
              </div>
              <span className="text-sm text-gray-500">{transactions.sales_returns.length} records</span>
            </div>
            {transactionsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-[#00CED1] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading transactions...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="sales-returns-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Return #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Original Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Refund Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.sales_returns.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                          No sales returns found for this medicine
                        </td>
                      </tr>
                    ) : (
                      transactions.sales_returns.map((txn, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-red-600">{txn.return_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDateFull(txn.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{txn.customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{txn.original_invoice || '–'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{txn.batch_no}</td>
                          <td className="px-4 py-3 text-sm text-center font-medium text-red-600">+{txn.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-600">₹{txn.refund_amount?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              txn.status === 'refunded' ? 'bg-green-100 text-green-700' :
                              txn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {txn.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Help Button */}
      <button className="fixed bottom-6 right-6 w-12 h-12 bg-[#00CED1] text-white rounded-full shadow-lg hover:bg-[#00B5B8] flex items-center justify-center">
        <span className="text-xl font-bold">?</span>
      </button>
    </div>
  );
}
