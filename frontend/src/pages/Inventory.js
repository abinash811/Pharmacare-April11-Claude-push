import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/medicines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedicines(response.data);
    } catch (error) {
      toast.error('Failed to load medicines');
    }
    setLoading(false);
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const medicineData = {
      name: formData.get('name'),
      batch_number: formData.get('batch_number'),
      expiry_date: formData.get('expiry_date'),
      mrp: parseFloat(formData.get('mrp')),
      quantity: parseInt(formData.get('quantity')),
      supplier_name: formData.get('supplier_name'),
      purchase_rate: parseFloat(formData.get('purchase_rate')),
      selling_price: parseFloat(formData.get('selling_price')),
      hsn_code: formData.get('hsn_code')
    };

    try {
      await axios.post(`${API}/medicines`, medicineData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Medicine added successfully');
      setShowAddDialog(false);
      fetchMedicines();
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add medicine');
    }
  };

  const handleDeleteMedicine = async (medicineId) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;

    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/medicines/${medicineId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Medicine deleted successfully');
      fetchMedicines();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete medicine');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8" data-testid="inventory-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
          <p className="text-gray-600 mt-1">Manage your medicine stock</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="add-medicine-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Medicine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="add-medicine-dialog">
            <DialogHeader>
              <DialogTitle>Add New Medicine</DialogTitle>
              <DialogDescription>Enter medicine details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMedicine} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Medicine Name *</Label>
                  <Input name="name" required data-testid="medicine-name-input" />
                </div>
                <div>
                  <Label>Batch Number *</Label>
                  <Input name="batch_number" required data-testid="batch-number-input" />
                </div>
                <div>
                  <Label>Expiry Date *</Label>
                  <Input name="expiry_date" type="date" required data-testid="expiry-date-input" />
                </div>
                <div>
                  <Label>MRP *</Label>
                  <Input name="mrp" type="number" step="0.01" required data-testid="mrp-input" />
                </div>
                <div>
                  <Label>Quantity *</Label>
                  <Input name="quantity" type="number" required data-testid="quantity-input" />
                </div>
                <div>
                  <Label>Supplier Name *</Label>
                  <Input name="supplier_name" required data-testid="supplier-name-input" />
                </div>
                <div>
                  <Label>Purchase Rate *</Label>
                  <Input name="purchase_rate" type="number" step="0.01" required data-testid="purchase-rate-input" />
                </div>
                <div>
                  <Label>Selling Price *</Label>
                  <Input name="selling_price" type="number" step="0.01" required data-testid="selling-price-input" />
                </div>
                <div>
                  <Label>HSN Code</Label>
                  <Input name="hsn_code" data-testid="hsn-code-input" />
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="submit-medicine-btn">
                Add Medicine
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="medicines-table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {medicines.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      No medicines found. Add your first medicine.
                    </td>
                  </tr>
                ) : (
                  medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50" data-testid={`medicine-row-${med.id}`}>
                      <td className="px-6 py-4 font-medium text-gray-800">{med.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{med.batch_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(med.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          med.quantity < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {med.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">₹{med.mrp}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">₹{med.selling_price}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{med.supplier_name}</td>
                      <td className="px-6 py-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMedicine(med.id)}
                          data-testid={`delete-medicine-${med.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
