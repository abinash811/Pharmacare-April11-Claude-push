/**
 * MedicineDetailHeader — breadcrumb, product info, 6 stats cards, Edit button.
 * Props:
 *   product      {object}
 *   totalStock   {number}  packs
 *   totalUnits   {number}  units
 *   onEdit       {() => void}
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Edit2, Bell, Clock, Package, Percent, Hash,
  CreditCard, Calendar, FileText, ChevronRight,
} from 'lucide-react';
import { AppButton } from '@/components/shared';

function StatCard({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`bg-gray-50 rounded-xl p-4 border border-gray-100 ${className}`}>
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900 truncate" title={String(value)}>
        {value}
      </p>
    </div>
  );
}

export default function MedicineDetailHeader({ product, totalStock, totalUnits, onEdit }) {
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="px-6 py-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-4">
          <Link to="/inventory" className="text-brand hover:underline font-medium">
            INVENTORY
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-brand font-medium uppercase">
            {product.category || 'GENERAL'}
          </span>
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
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {product.name}
              </h1>
              <p className="text-gray-500">
                {product.manufacturer || product.brand || '–'} • {product.pack_info || `${product.units_per_pack || 1} units/pack`}
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
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-6 gap-4 mt-6">
          <StatCard icon={Percent}  label="GST"         value={`${product.gst_percent || 0}%`} />
          <StatCard icon={Package}  label="STOCK"       value={`${totalStock} (${totalUnits})`} />
          <StatCard icon={Hash}     label="HSN"         value={product.hsn_code || '–'} />
          <StatCard icon={CreditCard} label="MRP"       value={`₹${product.default_mrp_per_unit || 0}`} />
          <StatCard icon={Calendar} label="SCHEDULE"    value={product.schedule || 'Non-Restricted'} />
          <StatCard icon={FileText} label="COMPOSITION" value={product.composition || product.generic_name || '–'} />
        </div>
      </div>
    </div>
  );
}
