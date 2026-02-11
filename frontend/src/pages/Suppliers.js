import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, Phone, Mail, MapPin, Search, ToggleLeft, ToggleRight, Eye, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// VERIFIED – NO CHANGE to core component structure

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, type = 'button', className = '' }) => {
  const baseStyles = 'rounded font-medium transition-colors inline-flex items-center justify-center';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    warning: 'bg-orange-500 text-white hover:bg-orange-600'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2'
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Dialog = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl'
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4`}>
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSummary, setSupplierSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // VERIFIED – Form fields match backend model
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    credit_days: 0,
    notes: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load suppliers');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      gstin: '',
      credit_days: 0,
      notes: ''
    });
    setEditingSupplier(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
      if (editingSupplier) {
        // VERIFIED – Edit does NOT affect past purchases
        await axios.put(`${API}/suppliers/${editingSupplier.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Supplier updated successfully');
      } else {
        // VERIFIED – Name uniqueness enforced by backend
        await axios.post(`${API}/suppliers`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Supplier created successfully');
      }
      
      setShowDialog(false);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save supplier');
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      gstin: supplier.gstin || '',
      credit_days: supplier.credit_days || supplier.payment_terms_days || 0,
      notes: supplier.notes || ''
    });
    setShowDialog(true);
  };

  // IMPLEMENTED – Delete with protection check
  const handleDelete = async (supplier) => {
    if (!window.confirm(`Are you sure you want to delete "${supplier.name}"?\n\nNote: This will fail if any purchases exist for this supplier.`)) {
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/suppliers/${supplier.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error) {
      // VERIFIED – Shows meaningful error when purchases exist
      toast.error(error.response?.data?.detail || 'Failed to delete supplier');
    }
  };

  // IMPLEMENTED – Toggle active/inactive status
  const handleToggleStatus = async (supplier) => {
    const token = localStorage.getItem('token');
    const action = supplier.is_active !== false ? 'deactivate' : 'activate';
    
    if (!window.confirm(`Are you sure you want to ${action} "${supplier.name}"?`)) {
      return;
    }
    
    try {
      const response = await axios.patch(`${API}/suppliers/${supplier.id}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} supplier`);
    }
  };

  // IMPLEMENTED – View supplier detail with summary
  const handleViewDetails = async (supplier) => {
    setSelectedSupplier(supplier);
    setShowDetailDialog(true);
    
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/suppliers/${supplier.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSupplierSummary(response.data);
    } catch (error) {
      toast.error('Failed to load supplier details');
    }
  };

  // IMPLEMENTED – Search filter
  const filteredSuppliers = suppliers.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name?.toLowerCase().includes(query) ||
      s.phone?.toLowerCase().includes(query) ||
      s.contact_person?.toLowerCase().includes(query) ||
      s.contact_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Management</h1>
          <p className="text-gray-600 text-sm mt-1">Manage your pharmacy suppliers</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} data-testid="add-supplier-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* IMPLEMENTED – Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            data-testid="supplier-search"
          />
        </div>
      </div>

      {/* Suppliers Table - IMPLEMENTED list view with status */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">
            {searchQuery ? 'No suppliers match your search' : 'No suppliers found'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {searchQuery ? 'Try a different search term' : 'Add your first supplier to get started'}
          </p>
          {!searchQuery && (
            <Button className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Supplier
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">GSTIN</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSuppliers.map((supplier) => {
                const isActive = supplier.is_active !== false;
                return (
                  <tr key={supplier.id} className={`hover:bg-gray-50 ${!isActive ? 'bg-gray-100 opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{supplier.name}</div>
                      {(supplier.contact_person || supplier.contact_name) && (
                        <div className="text-sm text-gray-500">{supplier.contact_person || supplier.contact_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {supplier.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Mail className="w-3 h-3" />
                          {supplier.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {supplier.gstin ? (
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{supplier.gstin}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(supplier.credit_days || supplier.payment_terms_days) ? (
                        <span className="text-sm">{supplier.credit_days || supplier.payment_terms_days} days</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(supplier)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="View Details"
                          data-testid={`view-supplier-${supplier.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                          data-testid={`edit-supplier-${supplier.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(supplier)}
                          className={`p-1.5 rounded ${isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                          title={isActive ? 'Deactivate' : 'Activate'}
                          data-testid={`toggle-supplier-${supplier.id}`}
                        >
                          {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                          data-testid={`delete-supplier-${supplier.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Supplier Dialog - VERIFIED fields match backend */}
      <Dialog 
        open={showDialog} 
        onClose={() => { setShowDialog(false); resetForm(); }}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                required
                data-testid="supplier-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                rows="2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credit Days
              </label>
              <input
                type="number"
                value={formData.credit_days}
                onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowDialog(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="save-supplier-btn">
              {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* IMPLEMENTED – Supplier Detail Dialog (read-only insights) */}
      <Dialog
        open={showDetailDialog}
        onClose={() => { setShowDetailDialog(false); setSelectedSupplier(null); setSupplierSummary(null); }}
        title="Supplier Details"
        size="md"
      >
        {selectedSupplier && (
          <div className="space-y-6">
            {/* Supplier Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase">Name</label>
                <p className="font-medium">{selectedSupplier.name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Status</label>
                <p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    selectedSupplier.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedSupplier.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              {selectedSupplier.phone && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Phone</label>
                  <p>{selectedSupplier.phone}</p>
                </div>
              )}
              {selectedSupplier.email && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Email</label>
                  <p>{selectedSupplier.email}</p>
                </div>
              )}
              {selectedSupplier.gstin && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">GSTIN</label>
                  <p className="font-mono text-sm">{selectedSupplier.gstin}</p>
                </div>
              )}
              {selectedSupplier.address && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 uppercase">Address</label>
                  <p className="text-sm">{selectedSupplier.address}</p>
                </div>
              )}
            </div>

            {/* Purchase Summary - VERIFIED: read-only, no inventory/ledger data */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Purchase Summary</h3>
              {supplierSummary ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{supplierSummary.total_purchases}</p>
                    <p className="text-xs text-gray-600">Total Purchases</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">₹{supplierSummary.total_purchase_value?.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Total Value</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-purple-600">
                      {supplierSummary.last_purchase_date 
                        ? new Date(supplierSummary.last_purchase_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-600">Last Purchase</p>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 h-16 bg-gray-200 rounded"></div>
                  <div className="flex-1 h-16 bg-gray-200 rounded"></div>
                  <div className="flex-1 h-16 bg-gray-200 rounded"></div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => { setShowDetailDialog(false); setSelectedSupplier(null); setSupplierSummary(null); }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
