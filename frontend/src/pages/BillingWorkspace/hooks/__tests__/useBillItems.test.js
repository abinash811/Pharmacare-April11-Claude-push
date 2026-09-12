import { renderHook, act } from '@testing-library/react';
import { useBillItems } from '../useBillItems';

describe('useBillItems — expiry date bug (live-reported Sep 2026)', () => {
  // GET /products/search-with-batches sends TWO expiry fields per batch:
  // expiry_date, a pre-formatted "DD-MM-YYYY" display string, and
  // expiry_iso, the real ISO date (see _batch_for_billing,
  // backend/routers/inventory.py). addItem used to copy expiry_date
  // straight onto the bill item — date-fns' parseISO can't read
  // "DD-MM-YYYY", so isExpired/isExpiringSoon/formatExpiry on that item
  // silently failed everywhere downstream and the UI showed "–" instead
  // of the real expiry.
  const PRODUCT = { sku: 'DOLO650', name: 'Dolo 650', manufacturer: '', composition: '' };
  const BATCH_FROM_SEARCH = {
    id: 'batch-1', batch_no: '123456',
    expiry_date: '30-11-2026', expiry_iso: '2026-11-30',
    mrp_per_unit: 10, cost_price_per_unit: 7, qty_on_hand: 17,
  };

  it('stores a parseable ISO expiry date, not the pre-formatted display string', () => {
    const { result } = renderHook(() => useBillItems());
    act(() => { result.current.addItem(PRODUCT, BATCH_FROM_SEARCH); });

    expect(result.current.billItems[0].expiry_date).toBe('2026-11-30');
    expect(result.current.billItems[0].expiry_date).not.toBe('30-11-2026');
  });

  it('still falls back to expiry_date for a batch source that has no expiry_iso (e.g. GET /stock/batches, already ISO)', () => {
    const { result } = renderHook(() => useBillItems());
    const isoOnlyBatch = { ...BATCH_FROM_SEARCH, expiry_iso: undefined, expiry_date: '2026-11-30' };
    act(() => { result.current.addItem(PRODUCT, isoOnlyBatch); });

    expect(result.current.billItems[0].expiry_date).toBe('2026-11-30');
  });
});
