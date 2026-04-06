import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Edit, Trash2, Eye, Phone, Mail, MapPin, User, 
  Stethoscope, CreditCard, ShoppingBag, X, AlertCircle, FileSpreadsheet, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { exportCustomersToExcel } from '@/utils/excelExport';
import { fetchWithCache, invalidateCache } from '@/utils/cache';
import { SearchInput, PageSkeleton } from '@/components/shared';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);
  
  // Customer Dialog
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '', phone: '', email: '', address: '', customer_type: 'regular', gstin: '', credit_limit: 0, notes: ''
  });
  
  // Doctor Dialog
  const [showDoctorDialog, setShowDoctorDialog] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({
    name: '', contact: '', specialization: '', clinic_address: '', notes: ''
  });
  
  // Customer Detail Dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerStats, setCustomerStats] = useState(null);
  const [customerPurchases, setCustomerPurchases] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [customersRes, doctorsRes] = await Promise.all([
        axios.get(`${API}/customers?page_size=100`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/doctors?page_size=100`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      // Handle paginated response format
      setCustomers(customersRes.data.data || customersRes.data);
      setDoctors(doctorsRes.data.data || doctorsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  // Debounce search input
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  // Filter customers/doctors by debounced search
  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    c.phone?.includes(debouncedSearch) ||
    c.email?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const filteredDoctors = doctors.filter(d =>
    d.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    d.contact?.includes(debouncedSearch) ||
    d.specialization?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  // Customer CRUD
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      if (editingCustomer) {
        await axios.put(`${API}/customers/${editingCustomer.id}`, customerForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Customer updated successfully');
      } else {
        await axios.post(`${API}/customers`, customerForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Customer added successfully');
      }
      setShowCustomerDialog(false);
      resetCustomerForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save customer');
    }
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      customer_type: customer.customer_type || 'regular',
      gstin: customer.gstin || '',
      credit_limit: customer.credit_limit || 0,
      notes: customer.notes || ''
    });
    setShowCustomerDialog(true);
  };

  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Delete customer "${customer.name}"? This action cannot be undone.`)) return;
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/customers/${customer.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Customer deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete customer');
    }
  };

  const resetCustomerForm = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '', phone: '', email: '', address: '', customer_type: 'regular', gstin: '', credit_limit: 0, notes: ''
    });
  };

  // Doctor CRUD
  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      if (editingDoctor) {
        await axios.put(`${API}/doctors/${editingDoctor.id}`, doctorForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Doctor updated successfully');
      } else {
        await axios.post(`${API}/doctors`, doctorForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Doctor added successfully');
      }
      setShowDoctorDialog(false);
      resetDoctorForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save doctor');
    }
  };

  const handleEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      name: doctor.name || '',
      contact: doctor.contact || '',
      specialization: doctor.specialization || '',
      clinic_address: doctor.clinic_address || '',
      notes: doctor.notes || ''
    });
    setShowDoctorDialog(true);
  };

  const handleDeleteDoctor = async (doctor) => {
    if (!window.confirm(`Delete doctor "${doctor.name}"?`)) return;
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/doctors/${doctor.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Doctor deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete doctor');
    }
  };

  const resetDoctorForm = () => {
    setEditingDoctor(null);
    setDoctorForm({
      name: '', contact: '', specialization: '', clinic_address: '', notes: ''
    });
  };

  // View Customer Details
  const handleViewCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetailDialog(true);
    
    const token = localStorage.getItem('token');
    try {
      // Fetch customer stats and purchase history
      const [statsRes, purchasesRes] = await Promise.all([
        axios.get(`${API}/customers/${customer.id}/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/bills?customer_name=${encodeURIComponent(customer.name)}&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCustomerStats(statsRes.data);
      setCustomerPurchases(purchasesRes.data || []);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };

  const getCustomerTypeBadge = (type) => {
    const styles = {
      regular: 'bg-blue-100 text-blue-700',
      wholesale: 'bg-purple-100 text-purple-700',
      institution: 'bg-green-100 text-green-700'
    };
    // Fix NaN bug: default to 'regular' if type is null/undefined/empty
    const safeType = type && typeof type === 'string' && type.trim() ? type.toLowerCase() : 'regular';
    const displayType = safeType.charAt(0).toUpperCase() + safeType.slice(1);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[safeType] || styles.regular}`}>
        {displayType}
      </span>
    );
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="customers-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customers & Doctors</h1>
        <p className="text-sm text-gray-500">Manage customer and referring doctor information</p>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <div className="flex justify-between items-center gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="customers" className="data-[state=active]:bg-blue-50">
              <User className="w-4 h-4 mr-2" />
              Customers ({filteredCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="doctors" className="data-[state=active]:bg-green-50">
              <Stethoscope className="w-4 h-4 mr-2" />
              Doctors ({filteredDoctors.length})
            </TabsTrigger>
          </TabsList>

          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search..."
            className="w-64"
          />
        </div>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <div className="mb-4 flex justify-end gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                if (customers.length === 0) {
                  toast.error('No customers to export');
                  return;
                }
                exportCustomersToExcel(customers);
                toast.success('Exported to Excel');
              }}
              data-testid="export-customers-btn"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button 
              onClick={() => { resetCustomerForm(); setShowCustomerDialog(true); }} 
              data-testid="add-customer-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="customers-table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit Limit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>{searchQuery ? 'No customers match your search' : 'No customers found'}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{customer.name}</div>
                            {customer.gstin && (
                              <div className="text-xs text-gray-500">GSTIN: {customer.gstin}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Phone className="w-3 h-3" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Mail className="w-3 h-3" />
                                {customer.email}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getCustomerTypeBadge(customer.customer_type)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {customer.credit_limit > 0 && (
                              <span className="font-medium">₹{customer.credit_limit.toLocaleString()}</span>
                            )}
                            {!customer.credit_limit && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewCustomer(customer)} data-testid={`view-customer-${customer.id}`}>
                                <Eye className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(customer)}>
                                <Edit className="w-4 h-4 text-gray-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomer(customer)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors">
          <div className="mb-4 flex justify-end">
            <Button 
              onClick={() => { resetDoctorForm(); setShowDoctorDialog(true); }} 
              data-testid="add-doctor-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Doctor
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="doctors-table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doctor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Specialization</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredDoctors.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>{searchQuery ? 'No doctors match your search' : 'No doctors found'}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredDoctors.map((doctor) => (
                        <tr key={doctor.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">Dr. {doctor.name}</div>
                            {doctor.clinic_address && (
                              <div className="text-xs text-gray-500">{doctor.clinic_address}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {doctor.contact && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Phone className="w-3 h-3" />
                                {doctor.contact}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {doctor.specialization ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                {doctor.specialization}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditDoctor(doctor)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDoctor(doctor)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={(open) => { if (!open) resetCustomerForm(); setShowCustomerDialog(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Update customer information' : 'Enter customer details'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCustomerSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Customer Type</Label>
                <select
                  value={customerForm.customer_type}
                  onChange={(e) => setCustomerForm({ ...customerForm, customer_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="regular">Regular</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="institution">Institution</option>
                </select>
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                />
              </div>
              {(customerForm.customer_type === 'wholesale' || customerForm.customer_type === 'institution') && (
                <div>
                  <Label>GSTIN</Label>
                  <Input
                    value={customerForm.gstin}
                    onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
              )}
              <div>
                <Label>Credit Limit (₹)</Label>
                <Input
                  type="number"
                  value={customerForm.credit_limit}
                  onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetCustomerForm(); setShowCustomerDialog(false); }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Doctor Dialog */}
      <Dialog open={showDoctorDialog} onOpenChange={(open) => { if (!open) resetDoctorForm(); setShowDoctorDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
            <DialogDescription>
              {editingDoctor ? 'Update doctor information' : 'Enter doctor details'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDoctorSubmit} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={doctorForm.name}
                onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Contact</Label>
              <Input
                value={doctorForm.contact}
                onChange={(e) => setDoctorForm({ ...doctorForm, contact: e.target.value })}
              />
            </div>
            <div>
              <Label>Specialization</Label>
              <Input
                value={doctorForm.specialization}
                onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                placeholder="e.g., General Physician, Cardiologist"
              />
            </div>
            <div>
              <Label>Clinic Address</Label>
              <Input
                value={doctorForm.clinic_address}
                onChange={(e) => setDoctorForm({ ...doctorForm, clinic_address: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetDoctorForm(); setShowDoctorDialog(false); }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Details
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Name</label>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Type</label>
                  <p>{getCustomerTypeBadge(selectedCustomer.customer_type)}</p>
                </div>
                {selectedCustomer.phone && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Phone</label>
                    <p>{selectedCustomer.phone}</p>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Email</label>
                    <p>{selectedCustomer.email}</p>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 uppercase">Address</label>
                    <p className="text-sm">{selectedCustomer.address}</p>
                  </div>
                )}
              </div>

              {/* Stats Summary */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-3">Purchase Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {customerStats?.total_purchases || customerPurchases.length || 0}
                    </p>
                    <p className="text-xs text-gray-600">Total Bills</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      ₹{customerStats?.total_value?.toLocaleString() || customerPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600">Total Spent</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-purple-600">
                      {customerStats?.last_purchase || (customerPurchases[0] ? new Date(customerPurchases[0].created_at).toLocaleDateString() : 'N/A')}
                    </p>
                    <p className="text-xs text-gray-600">Last Purchase</p>
                  </div>
                </div>
              </div>

              {/* Recent Purchases */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-3">Recent Purchases</h3>
                {customerPurchases.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customerPurchases.slice(0, 5).map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => navigate(`/billing/${purchase.id}`)}
                      >
                        <div>
                          <p className="font-medium text-blue-600">{purchase.bill_number}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(purchase.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{purchase.total_amount?.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{purchase.items?.length || 0} items</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">No purchases yet</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
