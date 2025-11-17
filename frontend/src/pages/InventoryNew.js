import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InventoryNew() {
  const [products, setProducts] = useState([]);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [productBatches, setProductBatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showAddBatchDialog, setShowAddBatchDialog] = useState(false);
  const [selectedProductForBatch, setSelectedProductForBatch] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const fetchBatchesForProduct = async (productId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock/batches?product_id=${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductBatches(prev => ({
        ...prev,
        [productId]: response.data
      }));
    } catch (error) {
      toast.error('Failed to load batches');
    }
  };

  const toggleProductExpansion = (productId) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
      // Fetch batches if not already loaded
      if (!productBatches[productId]) {
        fetchBatchesForProduct(productId);
      }
    }
    setExpandedProducts(newExpanded);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const productData = {
      sku: formData.get('sku'),
      name: formData.get('name'),
      brand: formData.get('brand') || null,
      pack_size: formData.get('pack_size') || null,
      category: formData.get('category') || null,
      default_mrp: parseFloat(formData.get('default_mrp')),
      gst_percent: parseFloat(formData.get('gst_percent')),
      hsn_code: formData.get('hsn_code') || null
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

  const handleAddBatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const batchData = {
      product_id: selectedProductForBatch,
      batch_no: formData.get('batch_no'),
      expiry_date: formData.get('expiry_date'),
      qty_on_hand: parseInt(formData.get('qty_on_hand')),
      cost_price: parseFloat(formData.get('cost_price')),
      mrp: parseFloat(formData.get('mrp')),
      supplier_name: formData.get('supplier_name') || null
    };

    try {
      await axios.post(`${API}/stock/batches`, batchData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Batch added successfully');
      setShowAddBatchDialog(false);
      setSelectedProductForBatch(null);
      // Refresh batches for this product
      fetchBatchesForProduct(selectedProductForBatch);
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add batch');
    }
  };

  const openAddBatchDialog = (product) => {
    setSelectedProductForBatch(product.id);
    setShowAddBatchDialog(true);
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

  const calculateTotalQty = (productId) => {
    const batches = productBatches[productId] || [];
    return batches.reduce((sum, batch) => sum + (batch.qty_on_hand || 0), 0);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8" data-testid="inventory-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
          <p className="text-gray-600 mt-1">Manage products and stock batches</p>
        </div>
        <Button onClick={() => setShowAddProductDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pack Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <React.Fragment key={product.id}>
                    {/* Product Row */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleProductExpansion(product.id)}
                          className="flex items-center gap-2 text-sm font-medium text-blue-600"
                        >
                          {expandedProducts.has(product.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          {product.sku}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.brand || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.pack_size || '-'}</td>
                      <td className="px-4 py-3 text-sm">₹{product.default_mrp}</td>
                      <td className="px-4 py-3 text-sm">{product.gst_percent}%</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {expandedProducts.has(product.id) ? calculateTotalQty(product.id) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAddBatchDialog(product)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Batch
                        </Button>
                      </td>
                    </tr>

                    {/* Expanded Batches Row */}
                    {expandedProducts.has(product.id) && (
                      <tr>
                        <td colSpan="8" className="px-4 py-4 bg-gray-50">
                          <div className="ml-8">
                            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Stock Batches
                            </h4>
                            {productBatches[product.id] && productBatches[product.id].length > 0 ? (
                              <table className="w-full border rounded">
                                <thead className="bg-white">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch No</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty On Hand</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cost Price</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">MRP</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Supplier</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y bg-white">
                                  {productBatches[product.id].map((batch) => (
                                    <tr key={batch.id} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm">{batch.batch_no}</td>
                                      <td className="px-3 py-2 text-sm">{formatDate(batch.expiry_date)}</td>
                                      <td className="px-3 py-2 text-sm font-medium">{batch.qty_on_hand}</td>
                                      <td className="px-3 py-2 text-sm">₹{batch.cost_price}</td>
                                      <td className="px-3 py-2 text-sm">₹{batch.mrp}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600">{batch.supplier_name || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-gray-500">No batches available</p>
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
            <DialogDescription>Add a new product to your inventory</DialogDescription>
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
                <Label htmlFor="brand">Brand</Label>
                <Input name="brand" id="brand" />
              </div>
              <div>
                <Label htmlFor="pack_size">Pack Size</Label>
                <Input name="pack_size" id="pack_size" placeholder="e.g., 10 tablets" />
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
                <Label htmlFor="default_mrp">Default MRP *</Label>
                <Input name="default_mrp" id="default_mrp" type="number" step="0.01" required />
              </div>
              <div>
                <Label htmlFor="gst_percent">GST % *</Label>
                <Input name="gst_percent" id="gst_percent" type="number" step="0.01" defaultValue="5" required />
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

      {/* Add Batch Dialog */}
      <Dialog open={showAddBatchDialog} onOpenChange={setShowAddBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock Batch</DialogTitle>
            <DialogDescription>Add a new batch for this product</DialogDescription>
          </DialogHeader>
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
                <Label htmlFor="qty_on_hand">Quantity *</Label>
                <Input name="qty_on_hand" id="qty_on_hand" type="number" required />
              </div>
              <div>
                <Label htmlFor="cost_price">Cost Price *</Label>
                <Input name="cost_price" id="cost_price" type="number" step="0.01" required />
              </div>
              <div>
                <Label htmlFor="mrp">MRP *</Label>
                <Input name="mrp" id="mrp" type="number" step="0.01" required />
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
