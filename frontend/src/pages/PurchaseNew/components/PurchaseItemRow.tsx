/**
 * PurchaseItemRow — one editable line item in PurchaseItemsTable.
 * Extracted from PurchaseItemsTable.jsx (Sep 25, 2026) to keep that file
 * under the 300-line cap (Manifesto rule 4) as it grew a third per-line
 * feature (Pack/Unit, short/excess supply, price-change warning).
 */
import React from 'react';
import { Trash2, X } from 'lucide-react';
import AppButton from '@/components/shared/AppButton';
import { FilterPills } from '@/components/shared/FilterPills';
import { formatCurrency } from '@/utils/currency';
import { PURCHASE_QTY_MODE } from '@/constants/domainConstants';
import {
  isPackMode, toRealQty, toRealCostPerUnit, toRealMrpPerUnit, toRealReceivedQty, convertQtyMode,
} from '../utils/packUnitConversion';

const QTY_MODE_OPTIONS = [
  { key: PURCHASE_QTY_MODE.PACK, label: 'Pack' },
  { key: PURCHASE_QTY_MODE.UNIT, label: 'Unit' },
];

const inp = 'w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400';

export default function PurchaseItemRow({ item, index, onUpdateItem, onSetItemFields, onRemoveItem, withGST }) {
  // Real per-unit values regardless of Pack/Unit mode — see
  // packUnitConversion.js. Everything money/stock-related below (line
  // total, MRP-vs-cost warning) uses these, not the raw typed numbers,
  // since those mean different things depending on the mode.
  const qty = toRealQty(item);
  const ptr = toRealCostPerUnit(item);
  const mrp = toRealMrpPerUnit(item);
  const receivedQty = toRealReceivedQty(item);
  // Positive = short by this many, negative = excess by this many —
  // never affects cost/GST, only real stock.
  const receivedVariance = receivedQty === null ? 0 : qty - receivedQty;
  const gst = parseFloat(item.gst_percent) || 0;
  const lineTotal = qty * ptr;
  const total = lineTotal + (withGST ? lineTotal * (gst / 100) : 0);
  const costExceedsMrp = ptr > 0 && mrp > 0 && ptr > mrp;
  // Price-change warning (Sep 25, 2026) — compares against the last time
  // this product was actually purchased (any supplier, see
  // usePurchaseItems.js). null means either still loading or never
  // purchased before — either way, no warning to show.
  const costIncreased = item.last_cost_per_unit != null && ptr > item.last_cost_per_unit;
  const mrpChanged = item.last_mrp_per_unit != null && mrp !== item.last_mrp_per_unit;
  const packMode = isPackMode(item);
  const hasPack = (parseInt(item.units_per_pack) || 1) > 1;

  return (
    <tr className="hover:bg-brand-tint/50 transition-colors">
      <td className="px-3 py-2 text-xs text-gray-400">{index + 1}</td>
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-gray-800 truncate" title={item.product_name}>{item.product_name}</div>
        <div className="text-[10px] text-gray-500 truncate">
          {item.manufacturer && `Manf. ${item.manufacturer}`}{item.pack_size && ` | ${item.pack_size}`}
        </div>
        {hasPack && (
          <FilterPills
            options={QTY_MODE_OPTIONS}
            active={packMode ? PURCHASE_QTY_MODE.PACK : PURCHASE_QTY_MODE.UNIT}
            onChange={(mode) => onSetItemFields(item.id, convertQtyMode(item, mode))}
            className="mt-1"
          />
        )}
      </td>
      <td className="px-2 py-2">
        <input type="text" value={item.batch_no} onChange={(e) => onUpdateItem(item.id, 'batch_no', e.target.value)}
          placeholder="Batch" className={inp} style={{ position: 'relative', zIndex: 1 }} data-testid={`batch-${index}`} />
      </td>
      <td className="px-2 py-2">
        <input type="text" value={item.expiry_mmyy} placeholder="MM/YY" maxLength={5}
          onChange={(e) => {
            let val = e.target.value.replace(/[^\d/]/g, '');
            if (val.length === 2 && !val.includes('/') && item.expiry_mmyy.length < val.length) val = val + '/';
            if (val.length <= 5) onUpdateItem(item.id, 'expiry_mmyy', val);
          }}
          className={`${inp} text-center`} style={{ position: 'relative', zIndex: 1 }} data-testid={`expiry-${index}`} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min="1" value={item.qty_units} onChange={(e) => onUpdateItem(item.id, 'qty_units', e.target.value)}
          className={`${inp} text-center`} style={{ position: 'relative', zIndex: 1 }} data-testid={`qty-${index}`} />
        {packMode && (
          <div className="text-[9px] text-gray-400 text-center mt-0.5" data-testid={`qty-real-${index}`}>
            = {qty} units
          </div>
        )}
        {item.received_qty_units == null ? (
          <AppButton variant="chip" size="sm"
            className="text-[9px] w-full justify-center"
            onClick={() => onUpdateItem(item.id, 'received_qty_units', item.qty_units)}
            data-testid={`reveal-received-${index}`}
          >
            Received different qty?
          </AppButton>
        ) : (
          <div className="mt-1 flex items-center gap-1">
            <input type="number" min="0" value={item.received_qty_units}
              onChange={(e) => onUpdateItem(item.id, 'received_qty_units', e.target.value)}
              placeholder="Received"
              className="w-full h-7 px-1.5 text-[10px] text-center bg-amber-50 border border-amber-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
              style={{ position: 'relative', zIndex: 1 }} data-testid={`received-${index}`} />
            <AppButton variant="ghost" iconOnly size="sm"
              icon={<X className="w-3 h-3 text-gray-400" />}
              aria-label="Clear received quantity"
              onClick={() => onUpdateItem(item.id, 'received_qty_units', null)}
              data-testid={`clear-received-${index}`} />
          </div>
        )}
        {receivedVariance !== 0 && (
          <div className={`text-[9px] text-center mt-0.5 font-medium ${receivedVariance > 0 ? 'text-red-600' : 'text-blue-600'}`}
            data-testid={`received-variance-${index}`}>
            {receivedVariance > 0 ? `Short by ${receivedVariance}` : `Excess by ${Math.abs(receivedVariance)}`}
          </div>
        )}
      </td>
      <td className="px-2 py-2">
        <input type="number" min="0" value={item.free_qty_units} onChange={(e) => onUpdateItem(item.id, 'free_qty_units', e.target.value)}
          className="w-full h-8 px-2 text-xs text-center bg-green-50 border border-green-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
          style={{ position: 'relative', zIndex: 1 }} data-testid={`free-${index}`} />
      </td>
      <td className="px-2 py-2">
        <input type="number" step="0.01" value={item.ptr_per_unit} onChange={(e) => onUpdateItem(item.id, 'ptr_per_unit', e.target.value)}
          className={`${inp} text-right ${costExceedsMrp ? 'border-amber-400 bg-amber-50' : ''}`}
          style={{ position: 'relative', zIndex: 1 }} data-testid={`ptr-${index}`}
          title={costExceedsMrp ? "PTR is higher than MRP — you'd be selling this at a loss. Double-check both values." : undefined} />
        {packMode && (
          <div className="text-[9px] text-gray-400 text-right mt-0.5" data-testid={`ptr-real-${index}`}>
            = {formatCurrency(ptr)}/unit
          </div>
        )}
        {costIncreased && (
          <div className="text-[9px] text-amber-600 text-right mt-0.5 font-medium" data-testid={`ptr-increased-${index}`}>
            Was {formatCurrency(item.last_cost_per_unit)} last time
          </div>
        )}
      </td>
      <td className="px-2 py-2">
        <input type="number" step="0.01" value={item.mrp_per_unit} onChange={(e) => onUpdateItem(item.id, 'mrp_per_unit', e.target.value)}
          className={`${inp} text-right ${costExceedsMrp ? 'border-amber-400 bg-amber-50' : ''}`}
          style={{ position: 'relative', zIndex: 1 }} data-testid={`mrp-${index}`}
          title={costExceedsMrp ? "PTR is higher than MRP — you'd be selling this at a loss. Double-check both values." : undefined} />
        {packMode && (
          <div className="text-[9px] text-gray-400 text-right mt-0.5" data-testid={`mrp-real-${index}`}>
            = {formatCurrency(mrp)}/unit
          </div>
        )}
        {mrpChanged && (
          <div className="text-[9px] text-amber-600 text-right mt-0.5 font-medium" data-testid={`mrp-changed-${index}`}>
            MRP was {formatCurrency(item.last_mrp_per_unit)}
          </div>
        )}
      </td>
      <td className="px-2 py-2">
        <input type="number" step="0.1" value={item.gst_percent} onChange={(e) => onUpdateItem(item.id, 'gst_percent', e.target.value)}
          className={`${inp} text-center`} style={{ position: 'relative', zIndex: 1 }} data-testid={`gst-${index}`} />
      </td>
      <td className="px-2 py-2">
        <select value={item.batch_priority} onChange={(e) => onUpdateItem(item.id, 'batch_priority', e.target.value)}
          className="w-full h-8 px-1 text-[10px] bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ position: 'relative', zIndex: 1 }} data-testid={`lifa-${index}`}>
          <option value="LIFA">LIFA</option>
          <option value="LILA">LILA</option>
        </select>
      </td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">{formatCurrency(total)}</td>
      <td className="px-2 py-2">
        <AppButton variant="ghost" iconOnly icon={<Trash2 className="w-4 h-4 text-red-500" />}
          aria-label={`Remove ${item.product_name}`} onClick={() => onRemoveItem(item.id)}
          data-testid={`delete-${index}`} />
      </td>
    </tr>
  );
}
