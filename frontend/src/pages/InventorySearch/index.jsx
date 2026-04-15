/**
 * InventorySearch — orchestrator
 * Route: /inventory
 */
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { InlineLoader } from '@/components/shared';
import ExcelBulkUploadWizard from '@/components/ExcelBulkUploadWizard';

import { useInventorySearch }  from './hooks/useInventorySearch';
import InventoryHeader         from './components/InventoryHeader';
import InventorySearchBar      from './components/InventorySearchBar';
import InventoryEmptyState     from './components/InventoryEmptyState';
import InventoryTable          from './components/InventoryTable';
import FilterDrawer            from './components/FilterDrawer';
import BulkUpdateModal         from './components/BulkUpdateModal';
import AddStockModal           from './components/AddStockModal';
import AdjustStockModal        from './components/AdjustStockModal';
import EditProductModal        from './components/EditProductModal';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function InventorySearch() {
  const navigate       = useNavigate();
  const searchInputRef = useRef(null);

  const {
    searchQuery, setSearchQuery,
    activeFilters, applyFilters, removeFilter, clearAllFilters,
    filterOptions,
    inventory, loading, hasSearched,
    summary,
    currentPage, totalPages, totalItems, setPage,
    refetch,
  } = useInventorySearch();

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedItems, setSelectedItems] = useState(new Set());

  const handleSelectItem = (sku, checked) => {
    setSelectedItems(prev => { const s = new Set(prev); checked ? s.add(sku) : s.delete(sku); return s; });
  };
  const handleSelectAll = (checked) => {
    setSelectedItems(checked ? new Set(inventory.map(i => i.product.sku)) : new Set());
  };

  // ── Modal state ───────────────────────────────────────────────────────────
  const [showFilterDrawer,   setShowFilterDrawer]   = useState(false);
  const [showBulkModal,      setShowBulkModal]      = useState(false);
  const [showAddModal,       setShowAddModal]       = useState(false);
  const [showExcelWizard,    setShowExcelWizard]    = useState(false);
  const [adjustProduct,      setAdjustProduct]      = useState(null);
  const [editProduct,        setEditProduct]        = useState(null);

  // ── Bulk update ───────────────────────────────────────────────────────────
  const handleBulkConfirm = async (field, value) => {
    try {
      await api.post(apiUrl.productsBulkUpdate(), { skus: Array.from(selectedItems), field, value });
      toast.success(`Updated ${selectedItems.size} products successfully`);
      setShowBulkModal(false);
      setSelectedItems(new Set());
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk update failed');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleApplyFilters = (filters) => { applyFilters(filters); setShowFilterDrawer(false); };
  const handleViewLowStock = () => applyFilters({ stock_status: 'low_stock' });

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <InventoryHeader
        onAddStock={() => setShowAddModal(true)}
        onBulkUpload={() => setShowExcelWizard(true)}
      />

      <div className="p-6">
        <InventorySearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilters={activeFilters}
          onRemoveFilter={removeFilter}
          onClearAll={clearAllFilters}
          onOpenFilters={() => setShowFilterDrawer(true)}
          searchInputRef={searchInputRef}
        />

        {/* Results area */}
        {!hasSearched ? (
          <InventoryEmptyState
            summary={summary}
            onFocusSearch={() => searchInputRef.current?.focus()}
            onViewLowStock={handleViewLowStock}
          />
        ) : loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
            <div className="flex flex-col items-center">
              <InlineLoader text="Searching inventory…" />
            </div>
          </div>
        ) : inventory.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            No medicines found for your search.{hasActiveFilters && ' Try clearing some filters.'}
          </div>
        ) : (
          <InventoryTable
            inventory={inventory}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
            onRowClick={(item) => navigate(`/inventory/product/${item.product.sku}`)}
            onEdit={(item, e) => { e.stopPropagation(); setEditProduct(item.product); }}
            onAdjust={(item, e) => { e.stopPropagation(); setAdjustProduct(item); }}
            onBulkUpdate={() => setShowBulkModal(true)}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Filter Drawer ─────────────────────────────────────────────────── */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowFilterDrawer(false)} />
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
            <FilterDrawer filterOptions={filterOptions} activeFilters={activeFilters} onApply={handleApplyFilters} onClose={() => setShowFilterDrawer(false)} />
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showBulkModal && (
        <BulkUpdateModal
          selectedCount={selectedItems.size}
          filterOptions={filterOptions}
          onConfirm={handleBulkConfirm}
          onClose={() => setShowBulkModal(false)}
        />
      )}

      {showAddModal && (
        <AddStockModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); refetch(); }} />
      )}

      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSuccess={() => { setEditProduct(null); refetch(); }}
        />
      )}

      {adjustProduct && (
        <AdjustStockModal
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSuccess={() => { setAdjustProduct(null); refetch(); }}
        />
      )}

      <ExcelBulkUploadWizard
        isOpen={showExcelWizard}
        onClose={() => setShowExcelWizard(false)}
        onImportComplete={() => { setShowExcelWizard(false); refetch(); }}
      />
    </div>
  );
}
