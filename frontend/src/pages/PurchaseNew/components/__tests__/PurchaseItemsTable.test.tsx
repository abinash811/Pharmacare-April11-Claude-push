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

// The real modal is a full multi-field form (category, dosage form, GST%,
// opening stock...) already covered by its own tests elsewhere — here we
// only need to verify PurchaseItemsTable wires initialName in and the
// created product back out.
jest.mock('@/components/shared/AddMedicineModal', () => ({
  __esModule: true,
  default: ({ initialName, hideOpeningStock, onSuccess }:
    { initialName?: string; hideOpeningStock?: boolean; onSuccess: (p: unknown) => void }) => (
    <div data-testid="mock-add-medicine-modal">
      prefilled: {initialName}
      hideOpeningStock: {String(hideOpeningStock)}
      <div role="button" onClick={() => onSuccess({ id: 'new-1', sku: 'SKU-NEW', name: initialName, gst_percent: 5 })}>
        mock-create-medicine
      </div>
    </div>
  ),
}));

const PRODUCT = {
  id: 'p1', sku: 'SKU-1', name: 'Paracetamol 500mg', manufacturer: 'Cipla',
  strength: '500mg', gst_percent: 12,
};

describe('PurchaseItemsTable — search, barcode scan, add-new-medicine', () => {
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

  it('offers "add as new medicine" when the search finds nothing, prefilled with the typed name and opening stock hidden', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    render(<PurchaseItemsTable {...baseProps} />);
    await userEvent.type(screen.getByTestId('product-search'), 'Brand New Tablet');

    fireEvent.click(await screen.findByTestId('add-new-medicine-btn'));
    expect(await screen.findByText(/prefilled: Brand New Tablet/)).toBeInTheDocument();
    // Opening Stock would post a batch outside the purchase — the purchase's
    // own line-item batch entry is the single source of truth here instead.
    expect(screen.getByText(/hideOpeningStock: true/)).toBeInTheDocument();
  });

  it('adds the newly created medicine to the purchase and closes the modal', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    const onAddItem = jest.fn();
    render(<PurchaseItemsTable {...baseProps} onAddItem={onAddItem} />);
    await userEvent.type(screen.getByTestId('product-search'), 'Brand New Tablet');
    fireEvent.click(await screen.findByTestId('add-new-medicine-btn'));

    fireEvent.click(await screen.findByText('mock-create-medicine'));

    expect(onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'SKU-NEW', name: 'Brand New Tablet' }),
    );
    expect(screen.queryByTestId('mock-add-medicine-modal')).not.toBeInTheDocument();
  });

  it('warns on a line item where PTR (cost) is higher than MRP — selling it would lose money', () => {
    const items = [{
      id: 'i1', product_sku: 'SKU-1', product_name: 'Combiflam', manufacturer: '', pack_size: '',
      batch_no: '', expiry_mmyy: '', qty_units: 1, free_qty_units: 0,
      ptr_per_unit: 300, mrp_per_unit: 100, gst_percent: 5, batch_priority: 'LIFA',
    }];
    render(<PurchaseItemsTable {...baseProps} items={items} />);
    expect(screen.getByTestId('ptr-0')).toHaveClass('border-amber-400');
    expect(screen.getByTestId('mrp-0')).toHaveClass('border-amber-400');
  });

  it('does not warn when PTR is below MRP', () => {
    const items = [{
      id: 'i1', product_sku: 'SKU-1', product_name: 'Combiflam', manufacturer: '', pack_size: '',
      batch_no: '', expiry_mmyy: '', qty_units: 1, free_qty_units: 0,
      ptr_per_unit: 50, mrp_per_unit: 100, gst_percent: 5, batch_priority: 'LIFA',
    }];
    render(<PurchaseItemsTable {...baseProps} items={items} />);
    expect(screen.getByTestId('ptr-0')).not.toHaveClass('border-amber-400');
    expect(screen.getByTestId('mrp-0')).not.toHaveClass('border-amber-400');
  });
});
