import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import PurchaseItemsTable from '../PurchaseItemsTable';
import api from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockedGet = api.get as jest.Mock;

// The real modal drives a camera library (html5-qrcode) that has no place
// in jsdom — stand in with a trigger that calls onScan directly, the same
// contract the real modal honors. Deliberately not a raw button element,
// since those are banned repo-wide (CLAUDE.md Manifesto rule 1).
jest.mock('@/components/BarcodeScannerModal', () => ({
  __esModule: true,
  useUSBBarcodeScanner: jest.fn(),
  default: ({ isOpen, onScan }: { isOpen: boolean; onScan: (code: string) => void }) =>
    isOpen ? <div role="button" onClick={() => onScan('8901234567890')}>mock-scan-trigger</div> : null,
}));

const PRODUCT = {
  id: 'p1', sku: 'SKU-1', name: 'Paracetamol 500mg', manufacturer: 'Cipla',
  strength: '500mg', gst_percent: 12,
};

describe('PurchaseItemsTable — search + barcode scan', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseProps = {
    items: [], onUpdateItem: jest.fn(), onRemoveItem: jest.fn(), onAddItem: jest.fn(),
    withGST: true, searchInputRef: { current: null },
  };

  it('searches the server (not a preloaded catalog) and shows brand/strength in results', async () => {
    mockedGet.mockResolvedValueOnce({ data: [PRODUCT] });
    render(<PurchaseItemsTable {...baseProps} />);
    await userEvent.type(screen.getByTestId('product-search'), 'Para');

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('search=Para')));
    expect(await screen.findByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByText(/SKU: SKU-1 \| Cipla \| 500mg/)).toBeInTheDocument();
  });

  it('adds the clicked search result and clears the search box', async () => {
    mockedGet.mockResolvedValueOnce({ data: [PRODUCT] });
    const onAddItem = jest.fn();
    render(<PurchaseItemsTable {...baseProps} onAddItem={onAddItem} />);
    await userEvent.type(screen.getByTestId('product-search'), 'Para');
    fireEvent.click(await screen.findByText('Paracetamol 500mg'));

    expect(onAddItem).toHaveBeenCalledWith(PRODUCT);
    expect(screen.getByTestId('product-search')).toHaveValue('');
  });

  it('adds a product found by barcode scan, even with no stock yet', async () => {
    mockedGet.mockResolvedValueOnce({ data: { found: true, has_stock: false, product: PRODUCT } });
    const onAddItem = jest.fn();
    render(<PurchaseItemsTable {...baseProps} onAddItem={onAddItem} />);

    await userEvent.click(screen.getByTestId('purchase-scan-btn'));
    fireEvent.click(await screen.findByText('mock-scan-trigger'));

    await waitFor(() => expect(onAddItem).toHaveBeenCalledWith(PRODUCT));
    expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('products/barcode/8901234567890'));
  });

  it('shows an error toast when the scanned barcode matches nothing, without adding an item', async () => {
    mockedGet.mockResolvedValueOnce({ data: { found: false, message: 'No product found with barcode: 000' } });
    const onAddItem = jest.fn();
    render(<PurchaseItemsTable {...baseProps} onAddItem={onAddItem} />);

    await userEvent.click(screen.getByTestId('purchase-scan-btn'));
    fireEvent.click(await screen.findByText('mock-scan-trigger'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No product found with barcode: 000'));
    expect(onAddItem).not.toHaveBeenCalled();
  });
});
