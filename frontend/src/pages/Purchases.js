import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [purchasesRes, suppliersRes, medicinesRes] = await Promise.all([
        axios.get(`${API}/purchases`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/suppliers`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/medicines`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPurchases(purchasesRes.data);
      setSuppliers(suppliersRes.data);
      setMedicines(medicinesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const supplierData = {
      name: formData.get('name'),
      contact: formData.get('contact'),
      gstin: formData.get('gstin'),
      address: formData.get('address')
    };

    try {
      await axios.post(`${API}/suppliers`, supplierData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Supplier added successfully');
      setShowSupplierDialog(false);
      fetchData();
      e.target.reset();
    } catch (error) {
      toast.error('Failed to add supplier');
    }
  };

  const handleAddPurchase = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const supplier = suppliers.find(s => s.id === formData.get('supplier_id'));
    const medicine = medicines.find(m => m.id === formData.get('medicine_id'));
    const quantity = parseInt(formData.get('quantity'));
    const rate = parseFloat(formData.get('rate'));

    const purchaseData = {
      invoice_number: formData.get('invoice_number'),
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      items: [{
        medicine_id: medicine.id,
        medicine_name: medicine.name,
        quantity: quantity,
        rate: rate,
        total: quantity * rate
      }],
      total_amount: quantity * rate
    };

    try {
      await axios.post(`${API}/purchases`, purchaseData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Purchase added successfully');
      setShowAddDialog(false);
      fetchData();
      e.target.reset();
    } catch (error) {
      toast.error('Failed to add purchase');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8" data-testid="purchases-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Purchases</h1>
          <p className="text-gray-600 mt-1">Manage purchase orders</p>
        </div>
        <div className="flex space-x-3">
          <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="add-supplier-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-supplier-dialog">
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Enter supplier details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div>
                  <Label>Supplier Name *</Label>
                  <Input name="name" required data-testid="supplier-name-input" />
                </div>
                <div>
                  <Label>Contact *</Label>
                  <Input name="contact" required data-testid="supplier-contact-input" />
                </div>
                <div>
                  <Label>GSTIN</Label>
                  <Input name="gstin" data-testid="supplier-gstin-input" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input name="address" data-testid="supplier-address-input" />
                </div>
                <Button type="submit" className="w-full" data-testid="submit-supplier-btn">
                  Add Supplier
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-purchase-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Purchase
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-purchase-dialog">
              <DialogHeader>
                <DialogTitle>Add New Purchase</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPurchase} className="space-y-4">
                <div>
                  <Label>Invoice Number *</Label>
                  <Input name="invoice_number" required data-testid="invoice-number-input" />
                </div>
                <div>
                  <Label>Supplier *</Label>
                  <select
                    name="supplier_id"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="supplier-select"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Medicine *</Label>
                  <select
                    name="medicine_id"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="medicine-select"
                  >
                    <option value="">Select Medicine</option>
                    {medicines.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantity *</Label>
                  <Input name="quantity" type="number" required data-testid="purchase-quantity-input" />
                </div>
                <div>
                  <Label>Rate *</Label>
                  <Input name="rate" type="number" step="0.01" required data-testid="purchase-rate-input" />
                </div>
                <Button type="submit" className="w-full" data-testid="submit-purchase-btn">
                  Add Purchase
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="purchases-table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      No purchases found.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50" data-testid={`purchase-row-${purchase.id}`}>
                      <td className="px-6 py-4 font-medium text-gray-800">{purchase.invoice_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{purchase.supplier_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(purchase.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        ₹{purchase.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
