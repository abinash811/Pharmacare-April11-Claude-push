import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Package, History, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InventoryImproved() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [productBatches, setProductBatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showEditProductDialog, setShowEditProductDialog] = useState(false);
  const [showAddBatchDialog, setShowAddBatchDialog] = useState(false);
  const [showEditBatchDialog, setShowEditBatchDialog] = useState(false);
  const [showAdjustStockDialog, setShowAdjustStockDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Selected items
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load products');
      setLoading(false);
    }
  };

  const fetchBatchesForProduct = async (productSku) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock/batches?product_sku=${productSku}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductBatches(prev => ({
        ...prev,
        [productSku]: response.data
      }));
    } catch (error) {
      toast.error('Failed to load batches');
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(product => {
      // Search by product fields
      const matchesProduct = 
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.brand && product.brand.toLowerCase().includes(query));

      // Search by batch numbers if product is expanded
      const batches = productBatches[product.id] || [];
      const matchesBatch = batches.some(batch => 
        batch.batch_no.toLowerCase().includes(query)
      );

      return matchesProduct || matchesBatch;
    });

    setFilteredProducts(filtered);
  };

  const toggleProductExpansion = (product) => {
    const productKey = product.sku; // Use SKU as key
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productKey)) {
      newExpanded.delete(productKey);
    } else {
      newExpanded.add(productKey);
      if (!productBatches[productKey]) {
        fetchBatchesForProduct(product.sku);
      }
    }
    setExpandedProducts(newExpanded);
  };

  const calculateTotalQty = (productSku) => {
    const batches = productBatches[productSku] || [];
    return batches.reduce((sum, batch) => sum + (batch.qty_on_hand || 0), 0);
  };

  const getStatusBadge = (product) => {
    const totalQty = calculateTotalQty(product.id);
    const threshold = product.low_stock_threshold || 10;

    if (totalQty === 0) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Out of Stock</span>;
    } else if (totalQty <= threshold) {
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Low Stock</span>;
    } else {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">In Stock</span>;
    }
  };

  // Product CRUD
  const handleAddProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const productData = {
      sku: formData.get('sku'),
      name: formData.get('name'),
      manufacturer: formData.get('manufacturer') || null,
      brand: formData.get('brand') || null,
      pack_size: formData.get('pack_size') || null,
      units_per_pack: parseInt(formData.get('units_per_pack')) || 1,
      uom: formData.get('uom') || 'units',
      category: formData.get('category') || null,
      default_mrp_per_unit: parseFloat(formData.get('default_mrp_per_unit')),
      default_ptr_per_unit: parseFloat(formData.get('default_ptr_per_unit')) || null,
      gst_percent: parseFloat(formData.get('gst_percent')),
      hsn_code: formData.get('hsn_code') || null,
      low_stock_threshold_units: parseInt(formData.get('low_stock_threshold_units')) || 10,
      status: formData.get('status') || 'active'
    };

    try {
      await axios.post(`${API}/products`, productData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Product added successfully');
      setShowAddProductDialog(false);
      fetchProducts();
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add product');
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const productData = {
      name: formData.get('name'),
      manufacturer: formData.get('manufacturer') || null,
      brand: formData.get('brand') || null,
      pack_size: formData.get('pack_size') || null,
      units_per_pack: parseInt(formData.get('units_per_pack')) || 1,
      uom: formData.get('uom') || 'units',
      category: formData.get('category') || null,
      default_mrp_per_unit: parseFloat(formData.get('default_mrp_per_unit')),
      default_ptr_per_unit: parseFloat(formData.get('default_ptr_per_unit')) || null,
      gst_percent: parseFloat(formData.get('gst_percent')),
      hsn_code: formData.get('hsn_code') || null,
      low_stock_threshold_units: parseInt(formData.get('low_stock_threshold_units')) || 10,
      status: formData.get('status') || 'active'
    };

    try {
      await axios.put(`${API}/products/${selectedProduct.id}`, productData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Product updated successfully');
      setShowEditProductDialog(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update product');
    }
  };

  // Batch CRUD
  const handleAddBatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const batchData = {
      product_sku: selectedProduct.sku,
      batch_no: formData.get('batch_no'),
      manufacture_date: formData.get('manufacture_date') || null,
      expiry_date: formData.get('expiry_date'),
      qty_on_hand: parseInt(formData.get('qty_on_hand')),
      cost_price_per_unit: parseFloat(formData.get('cost_price_per_unit')),
      mrp_per_unit: parseFloat(formData.get('mrp_per_unit')) || selectedProduct.default_mrp_per_unit,
      supplier_name: formData.get('supplier_name') || null,
      supplier_invoice_no: formData.get('supplier_invoice_no') || null,
      received_date: formData.get('received_date') || null,
      location: formData.get('location') || 'default',
      free_qty_units: parseInt(formData.get('free_qty_units')) || 0,
      notes: formData.get('notes') || null
    };

    try {
      await axios.post(`${API}/stock/batches`, batchData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Batch added successfully');
      setShowAddBatchDialog(false);
      setSelectedProduct(null);
      fetchBatchesForProduct(batchData.product_id);
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add batch');
    }
  };

  const handleEditBatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const batchData = {
      cost_price: parseFloat(formData.get('cost_price')),
      mrp: parseFloat(formData.get('mrp'))
    };

    try {
      await axios.put(`${API}/stock/batches/${selectedBatch.id}`, batchData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Batch updated successfully');
      setShowEditBatchDialog(false);
      fetchBatchesForProduct(selectedBatch.product_id);
      setSelectedBatch(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update batch');
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const adjustmentType = formData.get('adjustment_type');
    const adjustmentValue = parseInt(formData.get('adjustment_value'));
    const reason = formData.get('reason');
    const notes = formData.get('notes');

    let newQty;
    if (adjustmentType === 'set') {
      newQty = adjustmentValue;
    } else if (adjustmentType === 'add') {
      newQty = selectedBatch.qty_on_hand + adjustmentValue;
    } else {
      newQty = selectedBatch.qty_on_hand - adjustmentValue;
    }

    if (newQty < 0) {
      toast.error('Quantity cannot be negative');
      return;
    }

    const quantityChange = newQty - selectedBatch.qty_on_hand;

    try {
      // Update batch quantity
      await axios.put(`${API}/stock/batches/${selectedBatch.id}`, {
        qty_on_hand: newQty
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Create stock movement record
      const product = products.find(p => p.id === selectedBatch.product_id);
      await axios.post(`${API}/stock-movements`, {
        product_id: selectedBatch.product_id,
        batch_id: selectedBatch.id,
        product_name: product?.name || 'Unknown',
        batch_no: selectedBatch.batch_no,
        quantity: quantityChange,
        movement_type: 'adjustment',
        ref_entity: 'adjustment',
        ref_id: selectedBatch.id,
        reason: `${reason}: ${notes || 'No additional notes'}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Stock adjusted successfully');
      setShowAdjustStockDialog(false);
      fetchBatchesForProduct(selectedBatch.product_id);
      setSelectedBatch(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to adjust stock');
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (batch.qty_on_hand > 0) {
      toast.error('Cannot delete batch with stock. Please adjust quantity to 0 first.');
      return;
    }

    if (!window.confirm(`Delete batch ${batch.batch_no}?`)) {
      return;
    }

    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/stock/batches/${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Batch deleted successfully');
      fetchBatchesForProduct(batch.product_id);
    } catch (error) {
      toast.error('Failed to delete batch');
    }
  };

  const handleViewHistory = async (product) => {
    setSelectedProduct(product);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock-movements?product_id=${product.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStockMovements(response.data);
      setShowHistoryDialog(true);
    } catch (error) {
      toast.error('Failed to load history');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8" data-testid="inventory-page">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Manage products and stock batches</p>
        </div>
        <Button onClick={() => setShowAddProductDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          placeholder="Search by product name, SKU, or batch number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pack Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <React.Fragment key={product.id}>
                    {/* Product Row */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleProductExpansion(product.id)}
                          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {expandedProducts.has(product.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          {product.sku}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.brand || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.pack_size || '-'}</td>
                      <td className="px-4 py-3 text-sm">₹{product.default_mrp}</td>
                      <td className="px-4 py-3 text-sm">{product.gst_percent}%</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {expandedProducts.has(product.id) ? calculateTotalQty(product.id) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {expandedProducts.has(product.id) && getStatusBadge(product)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowEditProductDialog(true);
                            }}
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowAddBatchDialog(true);
                            }}
                            title="Add Batch"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewHistory(product)}
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Batches Row */}
                    {expandedProducts.has(product.id) && (
                      <tr>
                        <td colSpan="9" className="px-4 py-4 bg-gray-50">
                          <div className="ml-8">
                            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Stock Batches
                            </h4>
                            {productBatches[product.id] && productBatches[product.id].length > 0 ? (
                              <table className="w-full border rounded bg-white">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch No</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty On Hand</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cost Price</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">MRP</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">GST %</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Supplier</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {productBatches[product.id].map((batch) => (
                                    <tr key={batch.id} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm font-medium">{batch.batch_no}</td>
                                      <td className="px-3 py-2 text-sm">{formatDate(batch.expiry_date)}</td>
                                      <td className="px-3 py-2 text-sm font-medium">{batch.qty_on_hand}</td>
                                      <td className="px-3 py-2 text-sm">₹{batch.cost_price}</td>
                                      <td className="px-3 py-2 text-sm">₹{batch.mrp}</td>
                                      <td className="px-3 py-2 text-sm">{product.gst_percent}%</td>
                                      <td className="px-3 py-2 text-sm text-gray-600">{batch.supplier_name || '-'}</td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex gap-1 justify-end">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setSelectedBatch(batch);
                                              setShowEditBatchDialog(true);
                                            }}
                                            title="Edit Batch"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setSelectedBatch(batch);
                                              setShowAdjustStockDialog(true);
                                            }}
                                            title="Adjust Stock"
                                          >
                                            <AlertCircle className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDeleteBatch(batch)}
                                            title="Delete Batch"
                                            disabled={batch.qty_on_hand > 0}
                                          >
                                            <Trash2 className="w-3 h-3 text-red-600" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-gray-500">No batches available. Click "+" to add a batch.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input name="sku" id="sku" required />
              </div>
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input name="name" id="name" required />
              </div>
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input name="manufacturer" id="manufacturer" placeholder="Company name" />
              </div>
              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input name="brand" id="brand" />
              </div>
              <div>
                <Label htmlFor="pack_size">Pack Size</Label>
                <Input name="pack_size" id="pack_size" placeholder="e.g., Strip, Box" />
              </div>
              <div>
                <Label htmlFor="units_per_pack">Units Per Pack *</Label>
                <Input name="units_per_pack" id="units_per_pack" type="number" defaultValue="1" placeholder="e.g., 10 tablets per strip" required />
              </div>
              <div>
                <Label htmlFor="uom">Unit of Measure</Label>
                <Input name="uom" id="uom" defaultValue="units" placeholder="units, ml, gm" />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input name="category" id="category" />
              </div>
              <div>
                <Label htmlFor="hsn_code">HSN Code</Label>
                <Input name="hsn_code" id="hsn_code" />
              </div>
              <div>
                <Label htmlFor="default_mrp_per_unit">MRP Per Unit *</Label>
                <Input name="default_mrp_per_unit" id="default_mrp_per_unit" type="number" step="0.01" required />
              </div>
              <div>
                <Label htmlFor="default_ptr_per_unit">PTR Per Unit</Label>
                <Input name="default_ptr_per_unit" id="default_ptr_per_unit" type="number" step="0.01" placeholder="Price to Retailer" />
              </div>
              <div>
                <Label htmlFor="gst_percent">GST % *</Label>
                <Input name="gst_percent" id="gst_percent" type="number" step="0.01" defaultValue="5" required />
              </div>
              <div>
                <Label htmlFor="low_stock_threshold_units">Low Stock Threshold (Units)</Label>
                <Input name="low_stock_threshold_units" id="low_stock_threshold_units" type="number" defaultValue="10" />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select name="status" id="status" className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddProductDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Product</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditProductDialog} onOpenChange={setShowEditProductDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>SKU (Cannot be changed)</Label>
                  <Input value={selectedProduct.sku} disabled />
                </div>
                <div>
                  <Label htmlFor="edit_name">Product Name *</Label>
                  <Input name="name" id="edit_name" defaultValue={selectedProduct.name} required />
                </div>
                <div>
                  <Label htmlFor="edit_brand">Brand</Label>
                  <Input name="brand" id="edit_brand" defaultValue={selectedProduct.brand || ''} />
                </div>
                <div>
                  <Label htmlFor="edit_pack_size">Pack Size</Label>
                  <Input name="pack_size" id="edit_pack_size" defaultValue={selectedProduct.pack_size || ''} />
                </div>
                <div>
                  <Label htmlFor="edit_units_per_pack">Units Per Pack *</Label>
                  <Input name="units_per_pack" id="edit_units_per_pack" type="number" defaultValue={selectedProduct.units_per_pack || 1} required />
                </div>
                <div>
                  <Label htmlFor="edit_category">Category</Label>
                  <Input name="category" id="edit_category" defaultValue={selectedProduct.category || ''} />
                </div>
                <div>
                  <Label htmlFor="edit_hsn_code">HSN Code</Label>
                  <Input name="hsn_code" id="edit_hsn_code" defaultValue={selectedProduct.hsn_code || ''} />
                </div>
                <div>
                  <Label htmlFor="edit_default_mrp">MRP *</Label>
                  <Input name="default_mrp" id="edit_default_mrp" type="number" step="0.01" defaultValue={selectedProduct.default_mrp} required />
                </div>
                <div>
                  <Label htmlFor="edit_gst_percent">GST % *</Label>
                  <Input name="gst_percent" id="edit_gst_percent" type="number" step="0.01" defaultValue={selectedProduct.gst_percent} required />
                </div>
                <div>
                  <Label htmlFor="edit_low_stock_threshold">Low Stock Threshold</Label>
                  <Input name="low_stock_threshold" id="edit_low_stock_threshold" type="number" defaultValue={selectedProduct.low_stock_threshold || 10} />
                </div>
                <div>
                  <Label htmlFor="edit_status">Status</Label>
                  <select name="status" id="edit_status" defaultValue={selectedProduct.status || 'active'} className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditProductDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Product</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Batch Dialog */}
      <Dialog open={showAddBatchDialog} onOpenChange={setShowAddBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock Batch</DialogTitle>
            <DialogDescription>
              {selectedProduct && `Add batch for: ${selectedProduct.name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleAddBatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch_no">Batch Number *</Label>
                  <Input name="batch_no" id="batch_no" required />
                </div>
                <div>
                  <Label htmlFor="expiry_date">Expiry Date *</Label>
                  <Input name="expiry_date" id="expiry_date" type="date" required />
                </div>
                <div>
                  <Label htmlFor="qty_on_hand">Opening Quantity *</Label>
                  <Input name="qty_on_hand" id="qty_on_hand" type="number" required />
                </div>
                <div>
                  <Label htmlFor="cost_price">Cost Price (PTR/PTS) *</Label>
                  <Input name="cost_price" id="cost_price" type="number" step="0.01" required />
                </div>
                <div>
                  <Label htmlFor="mrp">MRP</Label>
                  <Input name="mrp" id="mrp" type="number" step="0.01" placeholder={`Default: ₹${selectedProduct.default_mrp}`} />
                </div>
                <div>
                  <Label htmlFor="supplier_name">Supplier</Label>
                  <Input name="supplier_name" id="supplier_name" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddBatchDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Batch</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Batch Dialog */}
      <Dialog open={showEditBatchDialog} onOpenChange={setShowEditBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription>
              {selectedBatch && `Batch: ${selectedBatch.batch_no}`}
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <form onSubmit={handleEditBatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Batch Number (Cannot be changed)</Label>
                  <Input value={selectedBatch.batch_no} disabled />
                </div>
                <div className="col-span-2">
                  <Label>Expiry Date (Cannot be changed)</Label>
                  <Input value={formatDate(selectedBatch.expiry_date)} disabled />
                </div>
                <div>
                  <Label htmlFor="edit_cost_price">Cost Price (PTR/PTS) *</Label>
                  <Input name="cost_price" id="edit_cost_price" type="number" step="0.01" defaultValue={selectedBatch.cost_price} required />
                </div>
                <div>
                  <Label htmlFor="edit_mrp">MRP *</Label>
                  <Input name="mrp" id="edit_mrp" type="number" step="0.01" defaultValue={selectedBatch.mrp} required />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditBatchDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Batch</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustStockDialog} onOpenChange={setShowAdjustStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedBatch && `Batch: ${selectedBatch.batch_no} | Current Qty: ${selectedBatch.qty_on_hand}`}
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="adjustment_type">Adjustment Type *</Label>
                  <select name="adjustment_type" id="adjustment_type" className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm" required>
                    <option value="set">Set to New Quantity</option>
                    <option value="add">Add Quantity</option>
                    <option value="subtract">Subtract Quantity</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="adjustment_value">Quantity *</Label>
                  <Input name="adjustment_value" id="adjustment_value" type="number" required />
                </div>
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <select name="reason" id="reason" className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm" required>
                    <option value="Expired">Expired</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Audit">Audit Correction</option>
                    <option value="Return to Supplier">Return to Supplier</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea name="notes" id="notes" rows="3" className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Additional details..."></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAdjustStockDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Adjust Stock</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stock Movement History</DialogTitle>
            <DialogDescription>
              {selectedProduct && `Product: ${selectedProduct.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {stockMovements.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stockMovements.map((movement, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">{formatDate(movement.created_at)}</td>
                      <td className="px-3 py-2">{movement.batch_no}</td>
                      <td className="px-3 py-2 capitalize">{movement.movement_type}</td>
                      <td className={`px-3 py-2 text-right font-medium ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{movement.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-8 text-gray-500">No stock movements recorded</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
