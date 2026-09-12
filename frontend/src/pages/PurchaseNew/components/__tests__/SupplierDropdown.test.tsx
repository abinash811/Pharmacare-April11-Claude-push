import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupplierDropdown from '../SupplierDropdown';
import api from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const SUPPLIERS = [
  { id: 's1', name: 'MedPharma Distributors', gstin: '29ABCDE1234F1Z5' },
];

describe('SupplierDropdown — inline "add new distributor"', () => {
  beforeEach(() => jest.clearAllMocks());

  const openAndSearch = async (props: Record<string, unknown>, query: string) => {
    render(<SupplierDropdown suppliers={SUPPLIERS as any} value={null} onChange={jest.fn()} onSupplierCreated={jest.fn()} {...props} />);
    await userEvent.click(screen.getByTestId('supplier-selector'));
    await userEvent.type(await screen.findByTestId('supplier-search-input'), query);
  };

  it('does not show "add new" when allowCreate is off (e.g. PurchasesList filter usage)', async () => {
    await openAndSearch({ allowCreate: false }, 'Brand New Distributor Pvt Ltd');
    expect(screen.queryByTestId('add-new-supplier-btn')).not.toBeInTheDocument();
  });

  it('shows "add new" with the typed name when allowCreate is on and nothing matches', async () => {
    await openAndSearch({ allowCreate: true }, 'Brand New Distributor Pvt Ltd');
    expect(screen.getByTestId('add-new-supplier-btn')).toHaveTextContent('Brand New Distributor Pvt Ltd');
  });

  it('prefills the create-supplier form with the exact name that was typed', async () => {
    await openAndSearch({ allowCreate: true }, 'Brand New Distributor Pvt Ltd');
    await userEvent.click(screen.getByTestId('add-new-supplier-btn'));
    expect(await screen.findByDisplayValue('Brand New Distributor Pvt Ltd')).toBeInTheDocument();
  });

  it('creates the supplier, auto-selects it, and reports it to the parent — without a refetch', async () => {
    const created = { id: 'new-1', name: 'Brand New Distributor Pvt Ltd', payment_terms_days: 30 };
    (api.post as jest.Mock).mockResolvedValueOnce({ data: created });
    const onChange = jest.fn();
    const onSupplierCreated = jest.fn();

    render(<SupplierDropdown suppliers={SUPPLIERS as any} value={null} onChange={onChange} allowCreate onSupplierCreated={onSupplierCreated} />);
    await userEvent.click(screen.getByTestId('supplier-selector'));
    await userEvent.type(await screen.findByTestId('supplier-search-input'), 'Brand New Distributor Pvt Ltd');
    await userEvent.click(screen.getByTestId('add-new-supplier-btn'));
    await screen.findByDisplayValue('Brand New Distributor Pvt Ltd');
    await userEvent.click(screen.getByTestId('submit-supplier-btn'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      'suppliers',
      expect.objectContaining({ name: 'Brand New Distributor Pvt Ltd' }),
    ));
    expect(onChange).toHaveBeenCalledWith(created);
    expect(onSupplierCreated).toHaveBeenCalledWith(created);
  });

  it('surfaces the backend error (e.g. duplicate name) instead of silently failing', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({ response: { data: { detail: 'Supplier with this name already exists' } } });
    const onChange = jest.fn();

    render(<SupplierDropdown suppliers={SUPPLIERS as any} value={null} onChange={onChange} allowCreate onSupplierCreated={jest.fn()} />);
    await userEvent.click(screen.getByTestId('supplier-selector'));
    await userEvent.type(await screen.findByTestId('supplier-search-input'), 'MedPharma Distributors');
    fireEvent.click(screen.getByTestId('add-new-supplier-btn'));
    await screen.findByDisplayValue('MedPharma Distributors');
    await userEvent.click(screen.getByTestId('submit-supplier-btn'));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SupplierDropdown — outstanding balance visibility', () => {
  // Added Sep 12, 2026 (Suppliers v2): a purchase creator picking a
  // distributor with unpaid balances had no way to know that before this
  // — same gap as Billing's PatientCombobox, fixed for Customers first.
  const WITH_BALANCE = [
    { id: 's1', name: 'MedPharma Distributors', gstin: '29ABCDE1234F1Z5', outstanding: 5250 },
    { id: 's2', name: 'ZeroBalance Distributors', outstanding: 0 },
  ];

  it('shows the owed amount in the option list for a distributor with a balance', async () => {
    render(<SupplierDropdown suppliers={WITH_BALANCE as any} value={null} onChange={jest.fn()} onSupplierCreated={jest.fn()} />);
    await userEvent.click(screen.getByTestId('supplier-selector'));
    expect(await screen.findByText(/Owes ₹5,250/)).toBeInTheDocument();
  });

  it('shows no owed-amount line for a distributor with zero balance', async () => {
    render(<SupplierDropdown suppliers={WITH_BALANCE as any} value={null} onChange={jest.fn()} onSupplierCreated={jest.fn()} />);
    await userEvent.click(screen.getByTestId('supplier-selector'));
    const zeroOption = screen.getByTestId('supplier-option-s2');
    expect(zeroOption).not.toHaveTextContent(/Owes/);
  });

  it('reflects the owed amount on the selected chip via its title attribute', () => {
    render(<SupplierDropdown suppliers={WITH_BALANCE as any} value={WITH_BALANCE[0] as any} onChange={jest.fn()} onSupplierCreated={jest.fn()} />);
    expect(screen.getByTestId('supplier-selector')).toHaveAttribute('title', expect.stringContaining('owes'));
  });
});
