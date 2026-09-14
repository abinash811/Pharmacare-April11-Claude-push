import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useInventorySearch } from '../useInventorySearch';
import api from '@/lib/axios';

// Regression test for the Sep 14, 2026 Dashboard drill-down feature:
// the Dashboard's Low Stock/Expiring Soon "View All" buttons link to
// /inventory?stock_status=low_stock|near_expiry — this hook must read
// that param on mount and seed activeFilters with it, or the drill-down
// lands on an unfiltered inventory list.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const wrapper = (initialEntries: string[]) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };

describe('useInventorySearch — drill-down URL params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('seeds activeFilters.stock_status from ?stock_status=low_stock', async () => {
    const { result } = renderHook(() => useInventorySearch(), { wrapper: wrapper(['/inventory?stock_status=low_stock']) });
    expect(result.current.activeFilters).toEqual({ stock_status: 'low_stock' });
    await waitFor(() => expect(api.get as jest.Mock).toHaveBeenCalled());
  });

  it('seeds activeFilters.stock_status from ?stock_status=near_expiry', async () => {
    const { result } = renderHook(() => useInventorySearch(), { wrapper: wrapper(['/inventory?stock_status=near_expiry']) });
    expect(result.current.activeFilters).toEqual({ stock_status: 'near_expiry' });
    await waitFor(() => expect(api.get as jest.Mock).toHaveBeenCalled());
  });

  it('starts with no active filters when there is no stock_status param', async () => {
    const { result } = renderHook(() => useInventorySearch(), { wrapper: wrapper(['/inventory']) });
    expect(result.current.activeFilters).toEqual({});
    await waitFor(() => expect(api.get as jest.Mock).toHaveBeenCalled());
  });
});
