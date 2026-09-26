import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransferStockModal from '../TransferStockModal';
import api from '@/lib/axios';

// Regression tests for the Sep 26, 2026 multi-chain Phase 2, Step 5
// (docs/26_MULTI_CHAIN_SCOPE.md): bulk "Transfer Stock" action on the
// Inventory page.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const STORES = [
  { pharmacy_id: 'home', pharmacy_name: 'Home Store', role_name: 'admin', is_active: true },
  { pharmacy_id: 'p2', pharmacy_name: 'Second Store', role_name: 'admin', is_active: false },
];
const BATCHES_A = [
  { id: 'ba1', batch_no: 'B-EARLY', qty_on_hand: 20, expiry_date: '2027-01-01', product_name: 'Paracetamol 500mg' },
  { id: 'ba2', batch_no: 'B-LATER', qty_on_hand: 30, expiry_date: '2028-01-01', product_name: 'Paracetamol 500mg' },
];

describe('TransferStockModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('excludes the active store from the destination list and defaults to the earliest-expiring batch', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('users/me/stores')
        ? Promise.resolve({ data: STORES })
        : Promise.resolve({ data: BATCHES_A }));

    render(<TransferStockModal selectedSkus={['SKU-A']} onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('transfer-destination-select')).toBeInTheDocument());
    expect(screen.queryByText('Home Store')).not.toBeInTheDocument();
    expect(screen.getByText('Second Store')).toBeInTheDocument();

    const batchSelect = screen.getByTestId('transfer-batch-SKU-A') as HTMLSelectElement;
    expect(batchSelect.value).toBe('B-EARLY');
  });

  it('submits the chosen destination, batch, and quantity', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('users/me/stores')
        ? Promise.resolve({ data: STORES })
        : Promise.resolve({ data: BATCHES_A }));
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 't1' } });

    const onSuccess = jest.fn();
    render(<TransferStockModal selectedSkus={['SKU-A']} onClose={jest.fn()} onSuccess={onSuccess} />);

    await waitFor(() => expect(screen.getByTestId('transfer-qty-SKU-A')).toBeInTheDocument());
    await userEvent.type(screen.getByTestId('transfer-qty-SKU-A'), '5');
    await userEvent.click(screen.getByTestId('transfer-submit-btn'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('stock-transfers', {
      destination_pharmacy_id: 'p2',
      items: [{ product_sku: 'SKU-A', batch_number: 'B-EARLY', quantity: 5 }],
    }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('shows the real error reason when the transfer is rejected', async () => {
    const { toast } = require('sonner');
    (api.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('users/me/stores')
        ? Promise.resolve({ data: STORES })
        : Promise.resolve({ data: BATCHES_A }));
    (api.post as jest.Mock).mockRejectedValue({ message: 'Not enough stock in batch B-EARLY (have 20, requested 999)' });

    render(<TransferStockModal selectedSkus={['SKU-A']} onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('transfer-qty-SKU-A')).toBeInTheDocument());
    await userEvent.type(screen.getByTestId('transfer-qty-SKU-A'), '999');
    await userEvent.click(screen.getByTestId('transfer-submit-btn'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Not enough stock in batch B-EARLY (have 20, requested 999)'));
  });

  it('shows "No stock available" for a product with no batches left', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('users/me/stores')
        ? Promise.resolve({ data: STORES })
        : Promise.resolve({ data: [] }));

    render(<TransferStockModal selectedSkus={['SKU-EMPTY']} onClose={jest.fn()} onSuccess={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('No stock available')).toBeInTheDocument());
  });
});
