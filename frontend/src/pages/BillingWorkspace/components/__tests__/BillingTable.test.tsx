import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/axios';
import BillingTable from '../BillingTable';

const renderTable = (props: any) => render(<MemoryRouter><BillingTable {...props} /></MemoryRouter>);

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

    renderTable(baseProps);
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

    renderTable(baseProps);
    await userEvent.type(screen.getByTestId('new-item-search'), 'Sold');

    const row = await screen.findByTestId('out-of-stock-OUT-1');
    await userEvent.click(row);

    expect(baseProps.onItemAdded).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Sold Out Med'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('out of stock'));
  });

  it('shows a "no medicine found" message instead of nothing when a search has zero matches', async () => {
    // Same silent-failure class as the out-of-stock case above, found in the
    // same file Sep 19, 2026: GET /products/search-with-batches returning an
    // empty array rendered no dropdown at all, no message — a cashier typing
    // a real medicine name into a genuinely fresh pharmacy's Billing screen
    // (nothing purchased into stock yet) got dead silence with no next step.
    (api.get as jest.Mock).mockResolvedValue({ data: [] });

    renderTable(baseProps);
    await userEvent.type(screen.getByTestId('new-item-search'), 'Paracetamol');

    await waitFor(() => expect(
      screen.getByText(/No medicine found for "Paracetamol"/),
    ).toBeInTheDocument());
    // Real navigable links, not just bold text — Sep 22, 2026 fix.
    expect(screen.getByRole('link', { name: 'Purchases' })).toHaveAttribute('href', '/purchases/create');
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/inventory');
  });

  it('does not show cost price or margin % on a bill line — Sep 22, 2026 fix', () => {
    // Reported directly with a screenshot: every bill row showed the
    // batch's real cost price and a computed margin % (a fabricated one,
    // via an `item.unit_price * 0.7` fallback, when cost_price was
    // missing) under the medicine name — sensitive financial info a
    // cashier has no business seeing on every sale, and redundant with
    // the batch number already shown in its own column.
    renderTable({
      ...baseProps,
      billItems: [{
        id: '1', product_sku: 'X', product_name: 'Dolo 650', batch_no: '123456',
        qty: 1, unit_price: 20, cost_price: 7, gst_percent: 5, net_amount: 21,
        expiry_date: '2027-01-01', discount_percent: 0,
      }],
    });

    expect(screen.getByText('Dolo 650')).toBeInTheDocument();
    expect(screen.queryByText(/Cost ₹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/▲/)).not.toBeInTheDocument();
    expect(screen.queryByText(/43%/)).not.toBeInTheDocument();
  });

  it('shows a chevron on the batch chip so it reads as a dropdown, not plain text — Sep 25, 2026 fix', () => {
    // Roadmap-flagged gap: the batch cell was an AppButton variant="chip"
    // (deliberately chrome-less by design) showing only the batch number
    // in monospace, indistinguishable from static text until hovered.
    // DoctorDropdown/PatientCombobox already use the same chip + trailing
    // chevron pattern to signal "this opens something" — matched here.
    renderTable({
      ...baseProps,
      billItems: [{
        id: '1', product_sku: 'X', product_name: 'Dolo 650', batch_no: '123456',
        qty: 1, unit_price: 20, cost_price: 7, gst_percent: 5, net_amount: 21,
        expiry_date: '2027-01-01', discount_percent: 0,
      }],
    });

    const batchButton = screen.getByTestId('batch-select-0');
    expect(batchButton).toHaveTextContent('123456');
    expect(batchButton.querySelector('svg')).toBeInTheDocument();
  });

  it('still allows billing an in-stock batch normally', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{
        sku: 'IN-STOCK-1', name: 'Available Med', has_stock: true,
        batches: [{ batch_no: 'B1', qty_on_hand: 5, mrp_per_unit: 10, expiry_iso: '2027-01-01' }],
      }],
    });

    renderTable(baseProps);
    await userEvent.type(screen.getByTestId('new-item-search'), 'Available');

    const batchRow = await screen.findByText('B1');
    await userEvent.click(batchRow);

    expect(baseProps.onItemAdded).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
