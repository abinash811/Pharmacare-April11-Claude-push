/**
 * TransferStockModal — bulk-select action (multi-chain Phase 2, Step 5,
 * docs/26_MULTI_CHAIN_SCOPE.md): sends the selected products to another
 * store in the same chain. Defaults each product to its earliest-expiring
 * batch (FEFO) — quantity is never pre-filled, always a deliberate entry.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton, InlineLoader } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

const inputCls = 'w-24 h-9 px-2 rounded-lg border border-gray-300 text-sm text-right focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none';
const selectCls = 'h-9 px-2 rounded-lg border border-gray-300 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none';

interface Store { pharmacy_id: string; pharmacy_name: string; is_active: boolean; }
interface Batch { id: string; batch_no: string; qty_on_hand: number; expiry_date: string; product_name: string; }
interface Row { sku: string; name: string; batches: Batch[]; batchNo: string; quantity: string; }

export default function TransferStockModal({ selectedSkus, onClose, onSuccess }:
  { selectedSkus: string[]; onClose: () => void; onSuccess: () => void }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [destinationId, setDestinationId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storesRes, ...batchResults] = await Promise.all([
          api.get(apiUrl.myStores()),
          ...selectedSkus.map(sku => api.get(apiUrl.stockBatches({ product_sku: sku }))),
        ]);
        const otherStores = (storesRes.data || []).filter((s: Store) => !s.is_active);
        setStores(otherStores);
        if (otherStores.length > 0) setDestinationId(otherStores[0].pharmacy_id);

        setRows(selectedSkus.map((sku, i) => {
          const batches: Batch[] = (batchResults[i].data || []).filter((b: Batch) => b.qty_on_hand > 0);
          return {
            sku, name: batches[0]?.product_name || sku, batches,
            batchNo: batches[0]?.batch_no || '', quantity: '',
          };
        }));
      } catch (error: any) {
        toast.error(error.message || 'Failed to load stock for transfer');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  const updateRow = (sku: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => (r.sku === sku ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = rows
      .filter(r => r.batchNo && Number(r.quantity) > 0)
      .map(r => ({ product_sku: r.sku, batch_number: r.batchNo, quantity: Number(r.quantity) }));
    if (!destinationId || items.length === 0) {
      toast.error('Pick a destination store and a quantity for at least one item');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(apiUrl.stockTransfers(), { destination_pharmacy_id: destinationId, items });
      toast.success(`Transferred ${items.length} item${items.length !== 1 ? 's' : ''}`);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Stock transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Transfer Stock</DialogTitle></DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><InlineLoader text="Loading stock..." /></div>
        ) : stores.length === 0 ? (
          <p className="text-sm text-gray-600 py-4">
            Add another store under Settings → Stores first to transfer stock between locations.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="transfer-destination" className="block text-xs font-medium text-gray-700 mb-1">Send to</label>
              <select id="transfer-destination" className={`${selectCls} w-full`} value={destinationId}
                onChange={e => setDestinationId(e.target.value)} data-testid="transfer-destination-select">
                {stores.map(s => <option key={s.pharmacy_id} value={s.pharmacy_id}>{s.pharmacy_name}</option>)}
              </select>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rows.map(row => (
                <div key={row.sku} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
                    <p className="text-xs text-gray-500">{row.sku}</p>
                  </div>
                  {row.batches.length === 0 ? (
                    <span className="text-xs text-gray-500">No stock available</span>
                  ) : (
                    <>
                      <select className={selectCls} value={row.batchNo}
                        onChange={e => updateRow(row.sku, { batchNo: e.target.value })}
                        data-testid={`transfer-batch-${row.sku}`}>
                        {row.batches.map(b => (
                          <option key={b.id} value={b.batch_no}>
                            {b.batch_no} ({b.qty_on_hand} left, exp {b.expiry_date})
                          </option>
                        ))}
                      </select>
                      <input type="number" min={1}
                        max={row.batches.find(b => b.batch_no === row.batchNo)?.qty_on_hand}
                        className={inputCls} placeholder="Qty" value={row.quantity}
                        onChange={e => updateRow(row.sku, { quantity: e.target.value })}
                        data-testid={`transfer-qty-${row.sku}`} />
                    </>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <AppButton type="button" variant="secondary" onClick={onClose}>Cancel</AppButton>
              <AppButton type="submit" loading={submitting} data-testid="transfer-submit-btn">Transfer</AppButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
