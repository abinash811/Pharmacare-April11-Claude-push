import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '@/lib/axios';
import PatientCombobox from '../PatientCombobox';

jest.mock('@/lib/axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

// Regression tests for the Sep 13, 2026 Billing product-review finding —
// same root cause and same fix as DoctorDropdown.test.tsx: BillingSubbar's
// toolbar row clips vertical overflow (overflow-x-auto forces overflow-y
// to "auto" per the CSS spec), so this dropdown's results were invisible
// no matter their z-index. Fixed via the shared Radix Popover (portal).
// These tests lock in the portal-outside-click regression the fix
// introduced and then fixed: since results/the add-form now render
// outside wrapperRef's DOM subtree, the existing outside-click handler
// misfired on every click inside them.
describe('PatientCombobox', () => {
  const baseProps = { value: '', phone: '', onSelect: jest.fn(), readOnly: false };

  beforeEach(() => jest.clearAllMocks());

  it('shows Walk-in and DB matches when typing', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: [{ id: 'p1', name: 'Rahul Verma', phone: '9812345678' }] },
    });

    render(<PatientCombobox {...baseProps} />);
    await userEvent.click(screen.getByTestId('patient-chip'));
    expect(screen.getByText('Counter / Walk-in')).toBeInTheDocument();

    await userEvent.type(screen.getByTestId('patient-search-input'), 'Rahul');
    await waitFor(() => expect(screen.getByTestId('patient-result-p1')).toBeInTheDocument());
  });

  it('selecting a result calls onSelect with the real patient, not the raw typed query', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: [{ id: 'p1', name: 'Rahul Verma', phone: '9812345678' }] },
    });
    const onSelect = jest.fn();

    render(<PatientCombobox {...baseProps} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('patient-chip'));
    await userEvent.type(screen.getByTestId('patient-search-input'), 'Rahul');
    await waitFor(() => expect(screen.getByTestId('patient-result-p1')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('patient-result-p1'));

    expect(onSelect).toHaveBeenCalledWith({ name: 'Rahul Verma', phone: '9812345678', id: 'p1' });
  });

  it('clicking Counter / Walk-in selects a walk-in sale', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
    const onSelect = jest.fn();

    render(<PatientCombobox {...baseProps} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('patient-chip'));
    await userEvent.click(screen.getByText('Counter / Walk-in'));

    expect(onSelect).toHaveBeenCalledWith({ name: 'Counter Sale', phone: '', id: null });
  });

  it('the "Add new customer" flow creates and selects a customer without misfiring the outside-click handler', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 'p2', name: 'Brand New Customer', phone: '' },
    });
    const onSelect = jest.fn();

    render(<PatientCombobox {...baseProps} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('patient-chip'));
    await userEvent.type(screen.getByTestId('patient-search-input'), 'Brand New Customer');
    await waitFor(() => expect(screen.getByTestId('patient-add-new')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('patient-add-new'));
    // Mini add-form now renders (via the same portal) — clicking its own
    // "Add & Select" button must not be swallowed as an outside click.
    const addButton = await screen.findByRole('button', { name: /Add & Select/i });
    await userEvent.click(addButton);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ id: 'p2', name: 'Brand New Customer', phone: '' }));
  });
});
