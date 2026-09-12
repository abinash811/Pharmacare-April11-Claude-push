/**
 * BillImportModal — one-click distributor bill import (Excel/CSV only,
 * no email ingestion — Suppliers v3, named Pharmasoft gap).
 *
 * Uploads a file, shows the backend's parsed rows for review, then hands
 * only the matched, checked rows back to the parent to append into the
 * purchase's existing item list. Unmatched rows are never auto-added —
 * PurchaseItemsTable has no way to re-point an existing row at a
 * different product, so an unmatched row would be silently unsubmittable
 * if added directly; instead they're listed so the pharmacist adds them
 * the normal way (the "+ Add Item" search, with its own inline
 * create-new-product flow for a genuinely new medicine).
 */
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton, InlineLoader } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export interface ParsedBillItem {
  row: number;
  product_sku: string;
  product_name: string;
  matched_product: boolean;
  batch_no: string;
  expiry_mmyy: string;
  qty_units: number;
  cost_price_per_unit: number;
  mrp_per_unit: number;
  gst_percent: number;
  warnings: string[];
}

interface ParsedBillError {
  row: number;
  message: string;
}

interface ImportResult {
  items: ParsedBillItem[];
  errors: ParsedBillError[];
}

interface Props {
  onClose: () => void;
  onImport: (items: ParsedBillItem[]) => void;
}

const ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv';

export default function BillImportModal({ onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      setLoading(true);
      try {
        const res = await api.post(apiUrl.importPurchaseBill(), {
          filename: file.name, file_data: e.target?.result,
        });
        const data: ImportResult = res.data;
        setResult(data);
        const initialSelected: Record<number, boolean> = {};
        data.items.forEach(item => { if (item.matched_product) initialSelected[item.row] = true; });
        setSelected(initialSelected);
      } catch (err: any) {
        toast.error(err.response?.data?.detail || 'Failed to import bill');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const matchedItems = (result?.items || []).filter(i => i.matched_product);
  const unmatchedItems = (result?.items || []).filter(i => !i.matched_product);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleConfirm = () => {
    const chosen = (result?.items || []).filter(item => selected[item.row]);
    if (chosen.length === 0) { toast.error('Select at least one item to import'); return; }
    onImport(chosen);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Distributor Bill</DialogTitle>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            {loading ? (
              <InlineLoader text="Reading bill..." />
            ) : (
              <AppButton
                variant="ghost"
                onClick={() => inputRef.current?.click()}
                className="w-full py-10 border-2 border-dashed border-gray-300 rounded-lg flex-col gap-2 text-gray-500 hover:border-brand hover:text-brand transition-colors h-auto"
                data-testid="bill-import-dropzone"
              >
                <Upload className="w-8 h-8" strokeWidth={1.5} />
                <span className="text-sm font-medium">Choose an Excel or CSV file</span>
              </AppButton>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={onFileChange}
              className="hidden"
              data-testid="bill-import-file-input"
            />
            <div className="text-xs text-gray-500">
              Expected columns: Product SKU or Product Name, Batch No, Expiry, Quantity, Cost Price, MRP, GST % (optional).
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {result.errors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <div className="font-medium flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" /> {result.errors.length} row(s) could not be read
                </div>
                {result.errors.map(e => (
                  <div key={e.row} className="text-xs">Row {e.row}: {e.message}</div>
                ))}
              </div>
            )}

            {matchedItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Ready to import ({matchedItems.length})
                </h3>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {matchedItems.map(item => (
                    <label key={item.row} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selected[item.row]}
                        onChange={(e) => setSelected(prev => ({ ...prev, [item.row]: e.target.checked }))}
                        data-testid={`bill-import-select-${item.row}`}
                      />
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.product_name}</div>
                        <div className="text-xs text-gray-500">
                          Batch {item.batch_no} · Qty {item.qty_units} · {formatCurrency(item.cost_price_per_unit)}/unit
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {unmatchedItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Needs manual entry ({unmatchedItems.length})
                </h3>
                <div className="border border-dashed border-gray-300 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                  {unmatchedItems.map(item => (
                    <div key={item.row} className="px-3 py-2 text-sm text-gray-600">
                      <span className="font-medium">{item.product_name}</span> — not found in inventory.
                      Add it via "+ Add Item" below, then fill in batch {item.batch_no}, qty {item.qty_units}.
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchedItems.length === 0 && unmatchedItems.length === 0 && (
              <div className="py-8 text-center text-gray-400">No items found in this file</div>
            )}
          </div>
        )}

        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          {result && (
            <AppButton onClick={handleConfirm} disabled={selectedCount === 0} data-testid="confirm-bill-import-btn">
              Import {selectedCount} Item{selectedCount === 1 ? '' : 's'}
            </AppButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
