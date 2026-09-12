import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import api from '@/lib/axios';
import BillingTable from '../BillingTable';

jest.mock('@/lib/axios', () => ({ get: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), info: jest.fn() } }));

// Live-reported bug (Sep 2026): a sold-out medicine used to vanish from this
// dropdown with no explanation (GET /products/search-with-batches silently
// dropped it). It's now returned marked has_stock: false, and this dropdown
// must show it as unavailable — visible, not hidden, and not selectable —
// rather than silently omitting it again on the frontend.
describe('BillingTable — out-of-stock search results', () => {
  const baseProps = {
    viewMode: 'new', billItems: [], onUpdateItem: jest.fn(),
    onRemoveItem: jest.fn(), onItemAdded: jest.fn(), searchInputRef: { current: null },
  };

  beforeEach(() => jest.clearAllMocks());

  it('shows a sold-out product as unavailable instead of omitting it', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          sku: 'IN-STOCK-1', name: 'Available Med', has_stock: true,
          batches: [{ batch_no: 'B1', qty_on_hand: 5, mrp_per_unit: 10, expiry_iso: '2027-01-01' }],
        },
        { sku: 'OUT-1', name: 'Sold Out Med', has_stock: false, batches: [] },
      ],
    });

    render(<BillingTable {...baseProps} />);
    await userEvent.type(screen.getByTestId('new-item-search'), 'Med');

    await waitFor(() => expect(screen.getByText('Sold Out Med')).toBeInTheDocument());
    expect(screen.getByText('Available Med')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByTestId('out-of-stock-OUT-1')).toBeInTheDocument();
  });

  it('blocks billing a sold-out product and shows why, instead of doing nothing', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ sku: 'OUT-1', name: 'Sold Out Med', has_stock: false, batches: [] }],
    });

    render(<BillingTable {...baseProps} />);
    await userEvent.type(screen.getByTestId('new-item-search'), 'Sold');

    const row = await screen.findByTestId('out-of-stock-OUT-1');
    await userEvent.click(row);

    expect(baseProps.onItemAdded).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Sold Out Med'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('out of stock'));
  });

  it('still allows billing an in-stock batch normally', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{
        sku: 'IN-STOCK-1', name: 'Available Med', has_stock: true,
        batches: [{ batch_no: 'B1', qty_on_hand: 5, mrp_per_unit: 10, expiry_iso: '2027-01-01' }],
      }],
    });

    render(<BillingTable {...baseProps} />);
    await userEvent.type(screen.getByTestId('new-item-search'), 'Available');

    const batchRow = await screen.findByText('B1');
    await userEvent.click(batchRow);

    expect(baseProps.onItemAdded).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
