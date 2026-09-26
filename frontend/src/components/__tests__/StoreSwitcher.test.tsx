import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '@/lib/axios';
import StoreSwitcher from '../StoreSwitcher';

jest.mock('@/lib/axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

// Regression tests for the Sep 26, 2026 multi-chain Phase 2 store switcher
// (docs/26_MULTI_CHAIN_SCOPE.md Step 2). Direct instruction: must show
// even for a single-store account, not conditionally hidden.
describe('StoreSwitcher', () => {
  const oneStore = [
    { pharmacy_id: 'p1', pharmacy_name: 'Only Pharmacy', role_name: 'admin', is_active: true },
  ];
  const twoStores = [
    { pharmacy_id: 'p1', pharmacy_name: 'First Pharmacy', role_name: 'admin', is_active: true },
    { pharmacy_id: 'p2', pharmacy_name: 'Second Pharmacy', role_name: 'manager', is_active: false },
  ];

  const reloadMock = jest.fn();

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true, value: { ...window.location, reload: reloadMock },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    reloadMock.mockClear();
  });

  it('shows the switcher trigger even with only one store', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: oneStore });
    render(<StoreSwitcher collapsed={false} />);
    expect(screen.getByTestId('store-switcher-trigger')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('store-switcher-trigger'));
    await waitFor(() => expect(screen.getByTestId('store-switcher-option-p1')).toBeInTheDocument());
  });

  it('switching to a different store calls the API then reloads', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: twoStores });
    (api.post as jest.Mock).mockResolvedValue({ data: { message: 'ok' } });
    render(<StoreSwitcher collapsed={false} />);

    await userEvent.click(screen.getByTestId('store-switcher-trigger'));
    await userEvent.click(await screen.findByTestId('store-switcher-option-p2'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      'users/me/switch-store', { pharmacy_id: 'p2' }));
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
  });

  it('clicking the already-active store does nothing', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: twoStores });
    render(<StoreSwitcher collapsed={false} />);

    await userEvent.click(screen.getByTestId('store-switcher-trigger'));
    await userEvent.click(await screen.findByTestId('store-switcher-option-p1'));

    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the real error reason when switching fails', async () => {
    const { toast } = require('sonner');
    (api.get as jest.Mock).mockResolvedValue({ data: twoStores });
    (api.post as jest.Mock).mockRejectedValue({ message: 'You do not have access to that store' });
    render(<StoreSwitcher collapsed={false} />);

    await userEvent.click(screen.getByTestId('store-switcher-trigger'));
    await userEvent.click(await screen.findByTestId('store-switcher-option-p2'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You do not have access to that store'));
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
