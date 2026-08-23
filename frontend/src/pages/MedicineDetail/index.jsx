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

  // The MRP stat card shows the price a customer would actually pay right
  // now, not a single "product MRP" — MRP lives per batch, not per product
  // (a pharmacy can be carrying two batches of the same medicine at
  // different MRPs). Batches come back expiry-ascending from the API, so
  // the first one still in stock is the FEFO batch — the same one billing
  // would sell next. Was previously read from product.default_mrp_per_unit,
  // a field that never existed on any product response and always showed
  // ₹0 (docs/15_ROADMAP.md RULE MISSES LOG).
  const currentBatch = batches.find(b => b.qty_on_hand > 0);
  const currentMrp = currentBatch?.mrp_per_unit ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <InlineLoader text="Loading medicine details..." />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-page">
      <MedicineDetailHeader
        product={product}
        totalStock={totalStock}
        totalUnits={totalUnits}
        currentMrp={currentMrp}
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
