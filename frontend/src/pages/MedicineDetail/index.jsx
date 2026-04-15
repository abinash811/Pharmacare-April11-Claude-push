/**
 * MedicineDetail — orchestrator
 * Route: /inventory/product/:sku
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { InlineLoader } from '@/components/shared';

import { useMedicineDetail }       from './hooks/useMedicineDetail';
import MedicineDetailHeader        from './components/MedicineDetailHeader';
import MedicineDetailTabs          from './components/MedicineDetailTabs';
import BatchesTab                  from './components/BatchesTab';
import TransactionTab              from './components/TransactionTab';
import LedgerTab                   from './components/LedgerTab';
import MedicineEditModal           from './components/MedicineEditModal';

const TRANSACTION_TABS = new Set(['purchases', 'pur_return', 'sales', 'sales_return']);

export default function MedicineDetail() {
  const { sku } = useParams();

  const {
    product, batches, loading, transactionsLoading,
    transactions, movements,
    fetchProductDetails, fetchBatches, fetchTransactions, fetchMovements, deleteBatches,
  } = useMedicineDetail(sku);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,        setActiveTab]        = useState('batches');
  const [hideZeroQty,      setHideZeroQty]      = useState(true);
  const [selectedBatches,  setSelectedBatches]  = useState(new Set());
  const [showEditModal,    setShowEditModal]     = useState(false);

  // Initial load
  useEffect(() => { if (sku) fetchProductDetails(); }, [sku]); // eslint-disable-line

  // Re-fetch batches when hideZeroQty changes (and product is loaded)
  useEffect(() => { if (product) fetchBatches(hideZeroQty); }, [product, hideZeroQty]); // eslint-disable-line

  // ── Tab change ────────────────────────────────────────────────────────────
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'ledger' && movements.length === 0) fetchMovements(batches);
    if (TRANSACTION_TABS.has(tab) && transactions.sales.length === 0 && transactions.purchases.length === 0) {
      fetchTransactions();
    }
  };

  // ── Batch selection ───────────────────────────────────────────────────────
  const handleSelectBatch = (id, checked) => {
    setSelectedBatches(prev => { const s = new Set(prev); checked ? s.add(id) : s.delete(id); return s; });
  };
  const handleSelectAll = (checked) => {
    setSelectedBatches(checked ? new Set(batches.map(b => b.id)) : new Set());
  };

  const handleDeleteBatches = async () => {
    const deleted = await deleteBatches(selectedBatches);
    if (deleted > 0) { setSelectedBatches(new Set()); fetchBatches(hideZeroQty); }
  };

  const totalStock = batches.reduce((sum, b) => sum + (b.qty_on_hand || 0), 0);
  const totalUnits = totalStock * (product?.units_per_pack || 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <InlineLoader text="Loading medicine details..." />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <MedicineDetailHeader
        product={product}
        totalStock={totalStock}
        totalUnits={totalUnits}
        onEdit={() => setShowEditModal(true)}
      />

      <MedicineDetailTabs activeTab={activeTab} onChange={handleTabChange} />

      <div className="p-6">
        {activeTab === 'batches' && (
          <BatchesTab
            batches={batches}
            product={product}
            selectedBatches={selectedBatches}
            hideZeroQty={hideZeroQty}
            onHideZeroQty={(checked) => { setHideZeroQty(checked); setSelectedBatches(new Set()); }}
            onSelectBatch={handleSelectBatch}
            onSelectAll={handleSelectAll}
            onDeleteBatches={handleDeleteBatches}
          />
        )}

        {activeTab === 'ledger' && <LedgerTab movements={movements} />}

        {TRANSACTION_TABS.has(activeTab) && (
          <TransactionTab type={activeTab} transactions={transactions} loading={transactionsLoading} />
        )}
      </div>

      {/* Floating help */}
      <button className="fixed bottom-6 right-6 w-12 h-12 bg-[#00CED1] text-white rounded-full shadow-lg hover:bg-[#00B5B8] flex items-center justify-center">
        <span className="text-xl font-bold">?</span>
      </button>

      {showEditModal && product && (
        <MedicineEditModal
          product={product}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => { setShowEditModal(false); fetchProductDetails(); }}
        />
      )}
    </div>
  );
}
