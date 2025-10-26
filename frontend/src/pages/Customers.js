import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showDoctorDialog, setShowDoctorDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [customersRes, doctorsRes] = await Promise.all([
        axios.get(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/doctors`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCustomers(customersRes.data);
      setDoctors(doctorsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const customerData = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      address: formData.get('address')
    };

    try {
      await axios.post(`${API}/customers`, customerData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Customer added successfully');
      setShowCustomerDialog(false);
      fetchData();
      e.target.reset();
    } catch (error) {
      toast.error('Failed to add customer');
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');

    const doctorData = {
      name: formData.get('name'),
      contact: formData.get('contact'),
      specialization: formData.get('specialization')
    };

    try {
      await axios.post(`${API}/doctors`, doctorData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Doctor added successfully');
      setShowDoctorDialog(false);
      fetchData();
      e.target.reset();
    } catch (error) {
      toast.error('Failed to add doctor');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8" data-testid="customers-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Customers & Doctors</h1>
        <p className="text-gray-600 mt-1">Manage customer and doctor information</p>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="customers" data-testid="customers-tab">Customers</TabsTrigger>
          <TabsTrigger value="doctors" data-testid="doctors-tab">Doctors</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <div className="mb-4 flex justify-end">
            <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-customer-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="add-customer-dialog">
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>Enter customer details</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input name="name" required data-testid="customer-name-input" />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input name="phone" required data-testid="customer-phone-input" />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input name="address" data-testid="customer-address-input" />
                  </div>
                  <Button type="submit" className="w-full" data-testid="submit-customer-btn">
                    Add Customer
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="customers-table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          No customers found.
                        </td>
                      </tr>
                    ) : (
                      customers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50" data-testid={`customer-row-${customer.id}`}>
                          <td className="px-6 py-4 font-medium text-gray-800">{customer.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{customer.phone}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{customer.address || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(customer.created_at).toLocaleDateString()}
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

        <TabsContent value="doctors">
          <div className="mb-4 flex justify-end">
            <Dialog open={showDoctorDialog} onOpenChange={setShowDoctorDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-doctor-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="add-doctor-dialog">
                <DialogHeader>
                  <DialogTitle>Add New Doctor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDoctor} className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input name="name" required data-testid="doctor-name-input" />
                  </div>
                  <div>
                    <Label>Contact</Label>
                    <Input name="contact" data-testid="doctor-contact-input" />
                  </div>
                  <div>
                    <Label>Specialization</Label>
                    <Input name="specialization" data-testid="doctor-specialization-input" />
                  </div>
                  <Button type="submit" className="w-full" data-testid="submit-doctor-btn">
                    Add Doctor
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="doctors-table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {doctors.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          No doctors found.
                        </td>
                      </tr>
                    ) : (
                      doctors.map((doctor) => (
                        <tr key={doctor.id} className="hover:bg-gray-50" data-testid={`doctor-row-${doctor.id}`}>
                          <td className="px-6 py-4 font-medium text-gray-800">{doctor.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{doctor.contact || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{doctor.specialization || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(doctor.created_at).toLocaleDateString()}
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
    </div>
  );
}
