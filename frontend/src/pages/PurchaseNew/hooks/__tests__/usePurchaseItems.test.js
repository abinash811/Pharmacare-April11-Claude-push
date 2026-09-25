import { renderHook, act, waitFor } from '@testing-library/react';
import { usePurchaseItems } from '../usePurchaseItems';
import api from '@/lib/axios';

// Regression tests for the Sep 25, 2026 price-change warning feature —
// addItem fetches the last real purchase price for this product (any
// supplier) and patches it into the item once resolved, advisory-only
// (never blocks adding the item, never throws on failure).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const PRODUCT = { sku: 'SKU-1', name: 'Paracetamol', gst_percent: 5, units_per_pack: 1 };

describe('usePurchaseItems — price-change lookup on addItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds the item immediately, before the price lookup resolves', () => {
    api.get.mockReturnValue(new Promise(() => { /* never resolves in this test */ }));
    const { result } = renderHook(() => usePurchaseItems());

    act(() => { result.current.addItem(PRODUCT); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].last_cost_per_unit).toBeNull();
    expect(result.current.items[0].last_mrp_per_unit).toBeNull();
  });

  it('patches last_cost_per_unit/last_mrp_per_unit once the lookup finds a prior purchase', async () => {
    api.get.mockResolvedValue({
      data: { found: true, cost_price_per_unit: 8, mrp_per_unit: 18 },
    });
    const { result } = renderHook(() => usePurchaseItems());

    act(() => { result.current.addItem(PRODUCT); });

    await waitFor(() => {
      expect(result.current.items[0].last_cost_per_unit).toBe(8);
      expect(result.current.items[0].last_mrp_per_unit).toBe(18);
    });
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('purchases/last-purchase-price'));
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('SKU-1'));
  });

  it('leaves last price fields null when nothing was ever purchased before', async () => {
    api.get.mockResolvedValue({ data: { found: false } });
    const { result } = renderHook(() => usePurchaseItems());

    act(() => { result.current.addItem(PRODUCT); });
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(result.current.items[0].last_cost_per_unit).toBeNull();
    expect(result.current.items[0].last_mrp_per_unit).toBeNull();
  });

  it('adding the item never fails even if the price lookup errors — advisory only', async () => {
    api.get.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => usePurchaseItems());

    act(() => { result.current.addItem(PRODUCT); });
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].last_cost_per_unit).toBeNull();
  });
});
