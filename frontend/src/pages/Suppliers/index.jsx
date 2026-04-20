/**
 * Suppliers — orchestrator
 * Route: /suppliers
 */
import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, SearchInput, DateRangePicker, PaginationBar, FilterPills, AppButton } from '@/components/shared';
import usePagination from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';

import { useSuppliers }          from './hooks/useSuppliers';
import SuppliersList             from './components/SuppliersList';
import SupplierDetailPanel       from './components/SupplierDetailPanel';
import SupplierFormModal         from './components/SupplierFormModal';
import SupplierPaymentModal      from './components/SupplierPaymentModal';

const FILTERS = [
  { key: 'all',         label: 'All'         },
  { key: 'active',      label: 'Active'      },
  { key: 'inactive',    label: 'Inactive'    },
  { key: 'outstanding', label: 'Outstanding' },
];

export default function Suppliers() {
  const { suppliers, loading, fetchSuppliers, saveSupplier, recordPayment, fetchPurchaseHistory } = useSuppliers();

  // ── Search & filter state ─────────────────────────────────────────────────
  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange,    setDateRange]    = useState({ start: null, end: null });
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Detail panel ──────────────────────────────────────────────────────────
  const [selectedSupplier,  setSelectedSupplier]  = useState(null);
  const [detailTab,         setDetailTab]         = useState('overview');
  const [purchaseHistory,   setPurchaseHistory]   = useState([]);
  const [historyLoading,    setHistoryLoading]    = useState(false);

  // ── Form/payment modals ───────────────────────────────────────────────────
  const [showForm,         setShowForm]         = useState(false);
  const [editingSupplier,  setEditingSupplier]  = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ── Pagination ────────────────────────────────────────────────────────────
  const pg = usePagination({ pageSize: 20 });

  useEffect(() => { fetchSuppliers(); }, []); // eslint-disable-line

  // Fetch purchase history when switching to history tab
  useEffect(() => {
    if (selectedSupplier && detailTab === 'history') {
      setHistoryLoading(true);
      fetchPurchaseHistory(selectedSupplier.id).then(data => {
        setPurchaseHistory(data);
        setHistoryLoading(false);
      });
    }
  }, [selectedSupplier, detailTab]); // eslint-disable-line

  // ── Filtered list ─────────────────────────────────────────────────────────
  const q = debouncedSearch.toLowerCase();
  const filtered = suppliers.filter(s => {
    if (q && !s.name?.toLowerCase().includes(q) && !s.phone?.toLowerCase().includes(q) && !s.gstin?.toLowerCase().includes(q)) return false;
    if (activeFilter === 'active'      && s.is_active === false)          return false;
    if (activeFilter === 'inactive'    && s.is_active !== false)          return false;
    if (activeFilter === 'outstanding' && (s.outstanding || 0) <= 0)     return false;
    return true;
  });

  // Sync pagination when filter changes
  useEffect(() => {
    pg.resetPage();
    pg.setTotal(filtered.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter, suppliers.length]);

  const pageSuppliers = pg.slice(filtered);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRowClick = (supplier) => { setSelectedSupplier(supplier); setDetailTab('overview'); };
  const handleEdit = (supplier) => { setEditingSupplier(supplier); setShowForm(true); };
  const handleAdd  = ()         => { setEditingSupplier(null); setShowForm(true); };
  const handleCloseForm = ()    => { setShowForm(false); setEditingSupplier(null); };

  const handlePaymentConfirm = async (amount, note) => {
    const updated = await recordPayment(selectedSupplier.id, { amount, note });
    setShowPaymentModal(false);
    if (updated) setSelectedSupplier(updated);
  };

  return (
    <div className="px-8 py-6 min-h-screen bg-page" data-testid="suppliers-page">
      <PageHeader
        title="Suppliers"
        actions={
          <AppButton onClick={handleAdd} data-testid="add-supplier-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </AppButton>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-4 mb-4">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Name, phone, GSTIN..." className="w-64" />
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        <FilterPills options={FILTERS} active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Split view */}
      <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white" style={{ height: 'calc(100vh - 220px)' }}>
        <div className={`overflow-auto ${selectedSupplier ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-0`}>
          <SuppliersList
            suppliers={pageSuppliers}
            selectedId={selectedSupplier?.id}
            loading={loading}
            searchQuery={searchQuery}
            onRowClick={handleRowClick}
            onAdd={handleAdd}
          />
          <PaginationBar {...pg} />
        </div>

        {selectedSupplier && (
          <div className="w-1/2 overflow-auto p-6 border-l border-gray-200">
            <SupplierDetailPanel
              supplier={selectedSupplier}
              onEdit={() => handleEdit(selectedSupplier)}
              onClose={() => setSelectedSupplier(null)}
              onRecordPayment={() => setShowPaymentModal(true)}
              purchaseHistory={purchaseHistory}
              historyLoading={historyLoading}
              activeTab={detailTab}
              onTabChange={setDetailTab}
            />
          </div>
        )}
      </div>

      <SupplierFormModal
        open={showForm}
        editingSupplier={editingSupplier}
        onClose={handleCloseForm}
        onSave={saveSupplier}
      />

      {showPaymentModal && selectedSupplier && (
        <SupplierPaymentModal
          supplier={selectedSupplier}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
        />
      )}
    </div>
  );
}
