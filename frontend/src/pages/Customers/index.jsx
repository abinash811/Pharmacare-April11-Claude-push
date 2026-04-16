/**
 * Customers — orchestrator
 * Route: /customers
 */
import React, { useState, useEffect } from 'react';
import { User, Stethoscope } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchInput, PageSkeleton, DeleteConfirmDialog, PaginationBar } from '@/components/shared';
import usePagination from '@/hooks/usePagination';
import { toast } from 'sonner';
import { exportCustomersToExcel } from '@/utils/excelExport';
import { useDebounce } from '@/hooks/useDebounce';

import { useCustomers }          from './hooks/useCustomers';
import CustomersTable            from './components/CustomersTable';
import DoctorsTable              from './components/DoctorsTable';
import CustomerFormDialog        from './components/CustomerFormDialog';
import DoctorFormDialog          from './components/DoctorFormDialog';
import CustomerDetailDialog      from './components/CustomerDetailDialog';

export default function Customers() {
  const { customers, doctors, loading, fetchData, saveCustomer, deleteCustomer, saveDoctor, deleteDoctor } = useCustomers();

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Customer dialog state ─────────────────────────────────────────────────
  const [showCustomerDialog,  setShowCustomerDialog]  = useState(false);
  const [editingCustomer,     setEditingCustomer]     = useState(null);

  // ── Doctor dialog state ───────────────────────────────────────────────────
  const [showDoctorDialog,    setShowDoctorDialog]    = useState(false);
  const [editingDoctor,       setEditingDoctor]       = useState(null);

  // ── Customer detail dialog ────────────────────────────────────────────────
  const [detailCustomer,      setDetailCustomer]      = useState(null);

  // ── Delete dialogs ────────────────────────────────────────────────────────
  const [delCustomer, setDelCustomer] = useState({ open: false, item: null, loading: false });
  const [delDoctor,   setDelDoctor]   = useState({ open: false, item: null, loading: false });

  // ── Pagination ────────────────────────────────────────────────────────────
  const custPg = usePagination({ pageSize: 20 });
  const docPg  = usePagination({ pageSize: 20 });

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  // ── Filtered lists ────────────────────────────────────────────────────────
  const q = debouncedSearch.toLowerCase();
  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
  );
  const filteredDoctors = doctors.filter(d =>
    d.name?.toLowerCase().includes(q) || d.contact?.includes(q) || d.specialization?.toLowerCase().includes(q)
  );

  // Sync pagination totals when filtered data changes
  useEffect(() => {
    custPg.resetPage();
    custPg.setTotal(filteredCustomers.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, customers.length]);

  useEffect(() => {
    docPg.resetPage();
    docPg.setTotal(filteredDoctors.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, doctors.length]);

  const pageCustomers = custPg.slice(filteredCustomers);
  const pageDoctors   = docPg.slice(filteredDoctors);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEditCustomer = (c) => { setEditingCustomer(c); setShowCustomerDialog(true); };
  const handleAddCustomer  = ()  => { setEditingCustomer(null); setShowCustomerDialog(true); };
  const handleCloseCustomerDialog = () => { setShowCustomerDialog(false); setEditingCustomer(null); };

  const handleEditDoctor   = (d) => { setEditingDoctor(d); setShowDoctorDialog(true); };
  const handleAddDoctor    = ()  => { setEditingDoctor(null); setShowDoctorDialog(true); };
  const handleCloseDoctorDialog = () => { setShowDoctorDialog(false); setEditingDoctor(null); };

  const confirmDeleteCustomer = async () => {
    setDelCustomer(p => ({ ...p, loading: true }));
    const ok = await deleteCustomer(delCustomer.item.id);
    setDelCustomer({ open: !ok, item: ok ? null : delCustomer.item, loading: false });
  };

  const confirmDeleteDoctor = async () => {
    setDelDoctor(p => ({ ...p, loading: true }));
    const ok = await deleteDoctor(delDoctor.item.id);
    setDelDoctor({ open: !ok, item: ok ? null : delDoctor.item, loading: false });
  };

  const handleExport = () => {
    if (customers.length === 0) { toast.error('No customers to export'); return; }
    exportCustomersToExcel(customers);
    toast.success('Exported to Excel');
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="customers-page">
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
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search..." className="w-64" />
        </div>

        <TabsContent value="customers">
          <CustomersTable
            customers={pageCustomers}
            searchQuery={searchQuery}
            onAdd={handleAddCustomer}
            onEdit={handleEditCustomer}
            onDelete={(c) => setDelCustomer({ open: true, item: c, loading: false })}
            onView={(c) => setDetailCustomer(c)}
            onExport={handleExport}
          />
          <PaginationBar {...custPg} />
        </TabsContent>

        <TabsContent value="doctors">
          <DoctorsTable
            doctors={pageDoctors}
            searchQuery={searchQuery}
            onAdd={handleAddDoctor}
            onEdit={handleEditDoctor}
            onDelete={(d) => setDelDoctor({ open: true, item: d, loading: false })}
          />
          <PaginationBar {...docPg} />
        </TabsContent>
      </Tabs>

      <CustomerFormDialog
        open={showCustomerDialog}
        editingCustomer={editingCustomer}
        onClose={handleCloseCustomerDialog}
        onSave={saveCustomer}
      />

      <DoctorFormDialog
        open={showDoctorDialog}
        editingDoctor={editingDoctor}
        onClose={handleCloseDoctorDialog}
        onSave={saveDoctor}
      />

      <CustomerDetailDialog
        open={!!detailCustomer}
        customer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
      />

      <DeleteConfirmDialog
        open={delCustomer.open}
        onClose={() => setDelCustomer({ open: false, item: null, loading: false })}
        onConfirm={confirmDeleteCustomer}
        itemName={delCustomer.item?.name ? `customer "${delCustomer.item.name}"` : 'this customer'}
        isLoading={delCustomer.loading}
      />

      <DeleteConfirmDialog
        open={delDoctor.open}
        onClose={() => setDelDoctor({ open: false, item: null, loading: false })}
        onConfirm={confirmDeleteDoctor}
        itemName={delDoctor.item?.name ? `doctor "${delDoctor.item.name}"` : 'this doctor'}
        isLoading={delDoctor.loading}
      />
    </div>
  );
}
