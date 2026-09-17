/**
 * InventoryEmptyState — shown only for a genuinely empty pharmacy
 * (no medicines added yet). Once at least one medicine exists, the
 * page's default view shows the 10 most recently added instead.
 * Props:
 *   onAddMedicine  {() => void}
 */
import React from 'react';
import { Package } from 'lucide-react';
import { AppButton } from '@/components/shared';

export default function InventoryEmptyState({ onAddMedicine }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="relative mb-6">
          <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center">
              <Package className="w-12 h-12 text-brand" />
            </div>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          No medicines yet
        </h3>
        <p className="text-gray-500 text-center max-w-md mb-6">
          Add your first medicine to start tracking stock levels, batches, and expiry dates.
        </p>

        <AppButton onClick={onAddMedicine} data-testid="empty-state-add-medicine-btn">
          Add Medicine
        </AppButton>
      </div>
    </div>
  );
}
