/**
 * MedicineDetailHeader — breadcrumb, product info, 6 stats cards, Edit button.
 * Props:
 *   product      {object}
 *   totalStock   {number}  packs
 *   totalUnits   {number}  units
 *   mrpDisplay   {string}  "–", "₹X.XX", or "₹X.XX–₹Y.YY" — MRP is per-batch, not
 *                          per-product, so a range means batches in stock disagree
 *                          on price rather than picking one silently.
 *   mrpTooltip   {string | null}  explanation shown on hover, only set when mrpDisplay
 *                                 is a range.
 *   onEdit       {() => void}
 */
import React from 'react';
import {
  Edit2, Package, Percent, Hash,
  CreditCard, Calendar, FileText, Snowflake, Info, MapPin,
} from 'lucide-react';
import { AppButton, PageBreadcrumb } from '@/components/shared';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

function StatCard({ icon: Icon, label, value, tooltip, className = '' }) {
  return (
    <div className={`bg-gray-50 rounded-xl p-4 border border-gray-100 ${className}`}>
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" data-testid="mrp-range-info" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {/* A range value ("₹100.00–150.00") is longer than every other stat
          this card shows and doesn't fit at text-lg without truncating —
          which would defeat the point of showing the range instead of a
          single number. Drop the font size once it's long enough to need it. */}
      <p className={`font-semibold text-gray-900 truncate ${String(value).length > 10 ? 'text-sm' : 'text-lg'}`} title={String(value)}>
        {value}
      </p>
    </div>
  );
}

export default function MedicineDetailHeader({ product, totalStock, totalUnits, mrpDisplay, mrpTooltip, onEdit }) {
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="px-6 py-4">
        {/* Breadcrumb */}
        <div className="mb-4">
          <PageBreadcrumb crumbs={[
            { label: 'Inventory', to: '/inventory' },
            { label: product.category || 'General' },
          ]} />
        </div>

        {/* Product info + actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {product.name}
                </h1>
                {product.strength && (
                  <span className="text-base font-medium text-gray-400">{product.strength}</span>
                )}
                {product.requires_refrigeration && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full"
                    title="Requires refrigeration"
                    data-testid="cold-chain-badge"
                  >
                    <Snowflake className="w-3 h-3" /> Cold Chain
                  </span>
                )}
              </div>
              <p className="text-gray-500">
                {product.manufacturer || product.brand || '–'} • {product.pack_info || `${product.units_per_pack || 1} units/pack`}
                {product.storage_location && (
                  <span className="inline-flex items-center gap-1 ml-2" data-testid="storage-location">
                    <MapPin className="w-3.5 h-3.5 inline" /> {product.storage_location}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AppButton
              onClick={onEdit}
              icon={<Edit2 className="w-4 h-4" />}
              data-testid="edit-product-btn"
            >
              Edit
            </AppButton>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-6 gap-4 mt-6">
          <StatCard icon={Percent}  label="GST"         value={`${product.gst_percent || 0}%`} />
          <StatCard icon={Package}  label="STOCK"       value={`${totalStock} (${totalUnits})`} />
          <StatCard icon={Hash}     label="HSN"         value={product.hsn_code || '–'} />
          <StatCard icon={CreditCard} label="MRP"       value={mrpDisplay} tooltip={mrpTooltip} />
          <StatCard icon={Calendar} label="SCHEDULE"    value={product.schedule || 'Non-Restricted'} />
          <StatCard icon={FileText} label="COMPOSITION" value={product.composition || product.generic_name || '–'} />
        </div>
      </div>
    </div>
  );
}
