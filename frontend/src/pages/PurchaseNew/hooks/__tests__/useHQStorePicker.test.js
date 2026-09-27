import { renderHook, waitFor } from '@testing-library/react';
import { useHQStorePicker } from '../useHQStorePicker';
import api from '@/lib/axios';

// Regression tests for the Sep 27, 2026 HQ-buyer store picker
// (docs/26_MULTI_CHAIN_SCOPE.md Section 3 #3).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const STORES = [
  { pharmacy_id: 'home', pharmacy_name: 'Home Store', role_name: 'admin', is_active: true },
  { pharmacy_id: 'p2', pharmacy_name: 'Second Store', role_name: 'admin', is_active: false },
];

describe('useHQStorePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the caller\'s stores and defaults to the currently active one', async () => {
    api.get.mockResolvedValue({ data: STORES });
    const { result } = renderHook(() => useHQStorePicker(null));

    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    expect(result.current.selectedStoreId).toBe('home');
  });

  it('does not fetch at all when editing an existing draft', () => {
    renderHook(() => useHQStorePicker('some-purchase-id'));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('stays empty (picker hidden) if the fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useHQStorePicker(null));

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(result.current.stores).toEqual([]);
  });
});
