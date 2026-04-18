/**
 * Customers — layout
 *
 * ┌── Sticky header rectangle ─────────────────────────────────────┐
 * │  Customers & Doctors                                            │
 * └────────────────────────────────────────────────────────────────┘
 * [Customers] [Doctors]   ← horizontal tab row
 * ─────────────────────────────────────────────────────────────────
 * [Search .....................]    [Export Excel] [+ Add Customer]
 * ─────────────────────────────────────────────────────────────────
 * TABLE
 */
import React, { useState, useEffect } from 'react';
import { User, Stethoscope, Plus, FileSpreadsheet } from 'lucide-react';
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

  const [activeSection, setActiveSection] = useState('customers');

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

  // Clear search when switching section
  useEffect(() => { setSearchQuery(''); }, [activeSection]);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const q = debouncedSearch.toLowerCase();
  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
  );
  const filteredDoctors = doctors.filter(d =>
    d.name?.toLowerCase().includes(q) || d.contact?.includes(q) || d.specialization?.toLowerCase().includes(q)
  );

  useEffect(() => {
    custPg.resetPage(); custPg.setTotal(filteredCustomers.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, customers.length]);

  useEffect(() => {
    docPg.resetPage(); docPg.setTotal(filteredDoctors.length);
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

  const isCustomers = activeSection === 'customers';

  return (
    <div className="flex flex-col h-full" data-testid="customers-page">

      {/* ── Sticky page header rectangle ──────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex-shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900">Customers &amp; Doctors</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage customer and referring doctor information</p>
      </div>

      {/* ── Horizontal tab row ────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-8 pt-4 pb-0 bg-white border-b border-gray-200">
        {[
          { key: 'customers', label: 'Customers', icon: User,        count: customers.length },
          { key: 'doctors',   label: 'Doctors',   icon: Stethoscope, count: doctors.length   },
        ].map(({ key, label, icon: Icon, count }) => {
          const active = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-[#4682B4] text-[#4682B4]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
              data-testid={`tab-${key}`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                active ? 'bg-[#4682B4]/10 text-[#4682B4]' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filter bar: search left · CTAs right ──────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-8 py-3 bg-white border-b border-gray-200">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={isCustomers ? 'Search customers…' : 'Search doctors…'}
          className="w-64"
        />
        <div className="flex items-center gap-2">
          {isCustomers && (
            <button
              onClick={handleExport}
              className="h-9 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              data-testid="export-customers-btn"
            >
              <FileSpreadsheet className="w-4 h-4 text-gray-500" />
              Export Excel
            </button>
          )}
          <button
            onClick={isCustomers ? handleAddCustomer : handleAddDoctor}
            className="h-9 px-4 rounded-lg bg-[#4682B4] text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors flex items-center gap-2"
            data-testid={isCustomers ? 'add-customer-btn' : 'add-doctor-btn'}
          >
            <Plus className="w-4 h-4" />
            {isCustomers ? 'Add Customer' : 'Add Doctor'}
          </button>
        </div>
      </div>

      {/* ── Table area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {isCustomers ? (
          <>
            <CustomersTable
              customers={pageCustomers}
              searchQuery={searchQuery}
              onEdit={handleEditCustomer}
              onDelete={(c) => setDelCustomer({ open: true, item: c, loading: false })}
              onView={(c) => setDetailCustomer(c)}
              onAdd={handleAddCustomer}
            />
            <PaginationBar {...custPg} />
          </>
        ) : (
          <>
            <DoctorsTable
              doctors={pageDoctors}
              searchQuery={searchQuery}
              onEdit={handleEditDoctor}
              onDelete={(d) => setDelDoctor({ open: true, item: d, loading: false })}
              onAdd={handleAddDoctor}
            />
            <PaginationBar {...docPg} />
          </>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
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
