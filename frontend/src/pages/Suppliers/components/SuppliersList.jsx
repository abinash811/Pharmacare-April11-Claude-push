/**
 * SuppliersList — left-panel suppliers table.
 * Props:
 *   suppliers        {Array}  (already filtered)
 *   selectedId       {number|null}
 *   loading          {boolean}
 *   searchQuery      {string}  for empty state
 *   onRowClick       {(supplier) => void}
 *   onAdd            {() => void}
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataCard, TableSkeleton, SuppliersEmptyState } from '@/components/shared';

export default function SuppliersList({ suppliers, selectedId, loading, searchQuery, onRowClick, onAdd }) {
  return (
    <DataCard>
      <table className="w-full" data-testid="suppliers-table">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Supplier','Contact','GSTIN','Outstanding','Status'].map(h => (
              <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                h === 'Outstanding' ? 'text-right' : h === 'Status' ? 'text-center' : 'text-left'
              }`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><td colSpan="5" className="p-0"><TableSkeleton rows={6} columns={5} /></td></tr>
          ) : suppliers.length === 0 ? (
            <tr>
              <td colSpan="5" className="p-0">
                <SuppliersEmptyState
                  filtered={!!searchQuery}
                  action={
                    <Button onClick={onAdd} data-testid="empty-add-supplier-btn">
                      <Plus className="w-4 h-4 mr-2" />Add Supplier
                    </Button>
                  }
                />
              </td>
            </tr>
          ) : (
            suppliers.map(supplier => {
              const isActive = supplier.is_active !== false;
              const outstanding = supplier.outstanding || 0;
              return (
                <tr
                  key={supplier.id}
                  className={`hover:bg-[#f0f7ff] cursor-pointer transition-colors ${selectedId === supplier.id ? 'bg-[#4682B4]/10' : ''} ${!isActive ? 'opacity-60' : ''}`}
                  onClick={() => onRowClick(supplier)}
                  data-testid={`supplier-row-${supplier.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{supplier.name}</div>
                    {supplier.contact_person && <div className="text-xs text-gray-500">{supplier.contact_person}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {supplier.phone && <div className="text-sm text-gray-700">{supplier.phone}</div>}
                    {supplier.email && <div className="text-xs text-gray-400 truncate max-w-[150px]">{supplier.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {supplier.gstin
                      ? <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{supplier.gstin}</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {outstanding > 0
                      ? <span className="font-semibold tabular-nums text-red-600">₹{outstanding.toFixed(2)}</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </DataCard>
  );
}
