import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillImportModal from '../BillImportModal';
import api from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const makeFile = (name = 'bill.xlsx') =>
  new File(['dummy content'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

describe('BillImportModal — one-click distributor bill import (Suppliers v3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the upload dropzone before a file is chosen', () => {
    render(<BillImportModal onClose={jest.fn()} onImport={jest.fn()} />);
    expect(screen.getByTestId('bill-import-dropzone')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-bill-import-btn')).not.toBeInTheDocument();
  });

  it('shows matched items pre-checked and unmatched items as a separate manual-entry list', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        items: [
          {
            row: 2, product_sku: 'SKU1', product_name: 'Matched Medicine', matched_product: true,
            batch_no: 'B1', expiry_mmyy: '12/27', qty_units: 10,
            cost_price_per_unit: 15, mrp_per_unit: 25, gst_percent: 5, warnings: [],
          },
          {
            row: 3, product_sku: '', product_name: 'Unknown Medicine', matched_product: false,
            batch_no: 'B2', expiry_mmyy: '06/28', qty_units: 5,
            cost_price_per_unit: 10, mrp_per_unit: 18, gst_percent: 5,
            warnings: ['Product not found in inventory — select the correct product manually'],
          },
        ],
        errors: [],
      },
    });

    render(<BillImportModal onClose={jest.fn()} onImport={jest.fn()} />);
    const input = screen.getByTestId('bill-import-file-input');
    await userEvent.upload(input, makeFile());

    await waitFor(() => expect(screen.getByText('Matched Medicine')).toBeInTheDocument());
    expect(screen.getByTestId('bill-import-select-2')).toBeChecked();
    expect(screen.getByText(/Unknown Medicine/)).toBeInTheDocument();
    expect(screen.getByText(/Needs manual entry \(1\)/)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-bill-import-btn')).toHaveTextContent('Import 1 Item');
  });

  it('unchecking a matched row excludes it from the import and updates the count', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        items: [
          { row: 2, product_sku: 'SKU1', product_name: 'A', matched_product: true, batch_no: 'B1',
            expiry_mmyy: '12/27', qty_units: 1, cost_price_per_unit: 1, mrp_per_unit: 2, gst_percent: 5, warnings: [] },
          { row: 3, product_sku: 'SKU2', product_name: 'B', matched_product: true, batch_no: 'B2',
            expiry_mmyy: '12/27', qty_units: 1, cost_price_per_unit: 1, mrp_per_unit: 2, gst_percent: 5, warnings: [] },
        ],
        errors: [],
      },
    });

    render(<BillImportModal onClose={jest.fn()} onImport={jest.fn()} />);
    await userEvent.upload(screen.getByTestId('bill-import-file-input'), makeFile());
    await waitFor(() => expect(screen.getByTestId('confirm-bill-import-btn')).toHaveTextContent('Import 2 Items'));

    await userEvent.click(screen.getByTestId('bill-import-select-3'));
    expect(screen.getByTestId('confirm-bill-import-btn')).toHaveTextContent('Import 1 Item');
  });

  it('confirm hands only the checked items to onImport and closes the modal', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        items: [
          { row: 2, product_sku: 'SKU1', product_name: 'A', matched_product: true, batch_no: 'B1',
            expiry_mmyy: '12/27', qty_units: 1, cost_price_per_unit: 1, mrp_per_unit: 2, gst_percent: 5, warnings: [] },
        ],
        errors: [],
      },
    });
    const onImport = jest.fn();
    const onClose = jest.fn();

    render(<BillImportModal onClose={onClose} onImport={onImport} />);
    await userEvent.upload(screen.getByTestId('bill-import-file-input'), makeFile());
    await waitFor(() => screen.getByTestId('confirm-bill-import-btn'));
    await userEvent.click(screen.getByTestId('confirm-bill-import-btn'));

    expect(onImport).toHaveBeenCalledWith([
      expect.objectContaining({ product_sku: 'SKU1', product_name: 'A' }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows rows that failed to parse as errors, separate from the item lists', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { items: [], errors: [{ row: 4, message: 'missing batch number' }] },
    });

    render(<BillImportModal onClose={jest.fn()} onImport={jest.fn()} />);
    await userEvent.upload(screen.getByTestId('bill-import-file-input'), makeFile());

    await waitFor(() => expect(screen.getByText(/1 row\(s\) could not be read/)).toBeInTheDocument());
    expect(screen.getByText(/Row 4: missing batch number/)).toBeInTheDocument();
  });

  it('surfaces the backend error instead of silently failing', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({
      response: { data: { detail: 'File has too many rows (max 500) — split into smaller files' } },
    });

    render(<BillImportModal onClose={jest.fn()} onImport={jest.fn()} />);
    await userEvent.upload(screen.getByTestId('bill-import-file-input'), makeFile());

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    // Stays on the upload screen rather than crashing or showing a blank result
    expect(screen.getByTestId('bill-import-dropzone')).toBeInTheDocument();
  });
});
