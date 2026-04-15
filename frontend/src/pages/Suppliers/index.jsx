/**
 * Suppliers — orchestrator
 * Route: /suppliers
 */
import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchInput, DateRangePicker } from '@/components/shared';
import { useDebounce } from '@/hooks/useDebounce';

import { useSuppliers }          from './hooks/useSuppliers';
import SuppliersList             from './components/SuppliersList';
import SupplierDetailPanel       from './components/SupplierDetailPanel';
import SupplierFormModal         from './components/SupplierFormModal';
import SupplierPaymentModal      from './components/SupplierPaymentModal';

const FILTERS = ['all', 'active', 'inactive', 'outstanding'];

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
    <div className="min-h-screen bg-gray-50" data-testid="suppliers-page">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              {suppliers.length} suppliers · {suppliers.filter(s => (s.outstanding || 0) > 0).length} with outstanding
            </span>
          </div>
          <Button onClick={handleAdd} data-testid="add-supplier-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Name, phone, GSTIN..." className="w-64" />
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        <div className="flex items-center gap-1 ml-4">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${activeFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              data-testid={`filter-${f}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
        <div className={`overflow-auto ${selectedSupplier ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6`}>
          <SuppliersList
            suppliers={filtered}
            selectedId={selectedSupplier?.id}
            loading={loading}
            searchQuery={searchQuery}
            onRowClick={handleRowClick}
            onAdd={handleAdd}
          />
        </div>

        {selectedSupplier && (
          <div className="w-1/2 overflow-auto p-4">
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
