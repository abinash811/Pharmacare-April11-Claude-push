import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddMedicineModal from '../AddMedicineModal';
import api from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockedGet = api.get as jest.Mock;
const mockedPost = api.post as jest.Mock;

const META = {
  categories: [{ value: 'tablet', label: 'Tablet', hsn_code: '3004', hsn_description: 'Medicaments' }],
  gst_rates: [5, 12],
  dosage_forms: [{ value: 'tablet', label: 'Tablet', divisible: true }],
};

describe('AddMedicineModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ data: META });
  });

  it('shows the Opening Stock section by default (standalone Inventory usage)', async () => {
    render(<AddMedicineModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Opening Stock')).toBeInTheDocument());
    expect(screen.getByTestId('medicine-batchno-input')).toBeInTheDocument();
  });

  it('hides Opening Stock entirely when opened mid-purchase, and never posts a batch', async () => {
    mockedPost.mockResolvedValueOnce({ data: { id: 'p1', sku: 'SKU-1', name: 'Combiflam' } });
    render(<AddMedicineModal onClose={jest.fn()} onSuccess={jest.fn()} hideOpeningStock initialName="Combiflam" />);
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(screen.queryByText('Opening Stock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('medicine-batchno-input')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByTestId('medicine-category-select'), 'tablet');
    await userEvent.selectOptions(screen.getByTestId('medicine-dosageform-select'), 'tablet');
    fireEvent.click(screen.getByTestId('add-medicine-submit-btn'));

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    expect(mockedPost).toHaveBeenCalledWith('products', expect.objectContaining({ name: 'Combiflam' }));
  });

  it('warns when Cost Price is higher than MRP in Opening Stock', async () => {
    render(<AddMedicineModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('medicine-mrp-input')).toBeInTheDocument());

    await userEvent.type(screen.getByTestId('medicine-mrp-input'), '100');
    await userEvent.type(screen.getByTestId('medicine-costprice-input'), '300');
    expect(await screen.findByTestId('cost-exceeds-mrp-warning')).toBeInTheDocument();
  });

  it('does not warn when Cost Price is below MRP', async () => {
    render(<AddMedicineModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('medicine-mrp-input')).toBeInTheDocument());

    await userEvent.type(screen.getByTestId('medicine-mrp-input'), '200');
    await userEvent.type(screen.getByTestId('medicine-costprice-input'), '100');
    expect(screen.queryByTestId('cost-exceeds-mrp-warning')).not.toBeInTheDocument();
  });
});
