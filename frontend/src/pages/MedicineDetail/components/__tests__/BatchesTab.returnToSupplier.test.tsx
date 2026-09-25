import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import BatchesTab from '../BatchesTab';
import api from '@/lib/axios';
import { toISODate } from '@/utils/dates';

// Sep 25, 2026 — a near-expiry/expired batch had no path to returning it
// to the supplier; a pharmacist had to already know and find the original
// purchase first. This is the new "Return to Supplier" action.

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const PRODUCT = { units_per_pack: 1, discount_percent: 0 };
const baseProps = {
  product: PRODUCT, selectedBatches: new Set(), hideZeroQty: false,
  onHideZeroQty: jest.fn(), onSelectBatch: jest.fn(), onSelectAll: jest.fn(), onDeleteBatches: jest.fn(),
};

const renderTab = (batches: any[]) =>
  render(<MemoryRouter><BatchesTab {...baseProps} batches={batches} nearExpiryDays={30} /></MemoryRouter>);

describe('BatchesTab — Return to Supplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the action for a near-expiry batch with stock, not for a healthy one', () => {
    const soon = toISODate(new Date(Date.now() + 10 * 86400000));
    const healthy = toISODate(new Date(Date.now() + 365 * 86400000));
    renderTab([
      { id: 'b1', batch_no: 'B1', qty_on_hand: 5, expiry_date: soon, mrp_per_unit: 10, cost_price_per_unit: 5 },
      { id: 'b2', batch_no: 'B2', qty_on_hand: 5, expiry_date: healthy, mrp_per_unit: 10, cost_price_per_unit: 5 },
    ]);
    expect(screen.getByTestId('return-to-supplier-b1')).toBeInTheDocument();
    expect(screen.queryByTestId('return-to-supplier-b2')).not.toBeInTheDocument();
  });

  it('hides the action for a near-expiry batch with zero stock left', () => {
    const soon = toISODate(new Date(Date.now() + 10 * 86400000));
    renderTab([{ id: 'b1', batch_no: 'B1', qty_on_hand: 0, expiry_date: soon, mrp_per_unit: 10, cost_price_per_unit: 5 }]);
    expect(screen.queryByTestId('return-to-supplier-b1')).not.toBeInTheDocument();
  });

  it('navigates to the pre-selected purchase return when one is found', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { found: true, purchase_id: 'pur-1', purchase_number: 'PUR-2026-0001' } });
    const soon = toISODate(new Date(Date.now() + 10 * 86400000));
    renderTab([{ id: 'b1', batch_no: 'B1', qty_on_hand: 5, expiry_date: soon, mrp_per_unit: 10, cost_price_per_unit: 5 }]);

    await userEvent.click(screen.getByTestId('return-to-supplier-b1'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/purchases/returns/create?purchase_id=pur-1');
    });
  });

  it('shows the real reason instead of navigating when the batch has no origin purchase', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { found: false } });
    const expired = toISODate(new Date(Date.now() - 10 * 86400000));
    renderTab([{ id: 'b1', batch_no: 'B1', qty_on_hand: 5, expiry_date: expired, mrp_per_unit: 10, cost_price_per_unit: 5 }]);

    await userEvent.click(screen.getByTestId('return-to-supplier-b1'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('B1'));
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
