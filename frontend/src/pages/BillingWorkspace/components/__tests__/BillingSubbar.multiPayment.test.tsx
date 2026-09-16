import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingSubbar from '../BillingSubbar';

// Regression tests for the Sep 16, 2026 Billing "Multi" payment rebuild —
// the split-entry panel (method + amount rows, add/remove, running total).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: [] }) },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const BASE_PROPS = {
  viewMode: 'new', billDate: new Date('2026-09-16'), onBillDateChange: jest.fn(),
  customerName: '', customerPhone: '', customerId: null, onPatientSelect: jest.fn(),
  doctorName: '', onDoctorChange: jest.fn(),
  paymentType: 'cash', onPaymentTypeChange: jest.fn(),
  paidNow: '', onPaidNowChange: jest.fn(),
  onBarcodeScan: jest.fn(),
  grandTotal: 500,
};

describe('BillingSubbar — Multi payment split panel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('seeds 2 empty split rows and shows the split panel when Multi is picked', async () => {
    const onPaymentTypeChange = jest.fn();
    const onPaymentSplitsChange = jest.fn();
    render(
      <BillingSubbar
        {...BASE_PROPS}
        paymentSplits={[]}
        onPaymentSplitsChange={onPaymentSplitsChange}
        onPaymentTypeChange={onPaymentTypeChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Multi' }));

    expect(onPaymentSplitsChange).toHaveBeenCalledWith([
      { method: '', amount: '' }, { method: '', amount: '' },
    ]);
    expect(onPaymentTypeChange).toHaveBeenCalledWith('multiple');
  });

  it('shows the split panel with existing rows when paymentType is already multiple', () => {
    render(
      <BillingSubbar
        {...BASE_PROPS}
        paymentType="multiple"
        paymentSplits={[{ method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }]}
        onPaymentSplitsChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('split-payment-panel')).toBeInTheDocument();
    expect(screen.getByTestId('split-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('split-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('split-total')).toHaveTextContent('₹500.00 / ₹500.00');
  });

  it('adds a new split row when Add is clicked', async () => {
    const onPaymentSplitsChange = jest.fn();
    render(
      <BillingSubbar
        {...BASE_PROPS}
        paymentType="multiple"
        paymentSplits={[{ method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }]}
        onPaymentSplitsChange={onPaymentSplitsChange}
      />,
    );

    await userEvent.click(screen.getByTestId('split-add-row'));

    expect(onPaymentSplitsChange).toHaveBeenCalledWith([
      { method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }, { method: '', amount: '' },
    ]);
  });

  it('cannot remove a row below 2 remaining splits', () => {
    render(
      <BillingSubbar
        {...BASE_PROPS}
        paymentType="multiple"
        paymentSplits={[{ method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }]}
        onPaymentSplitsChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('split-remove-0')).toBeDisabled();
    expect(screen.getByTestId('split-remove-1')).toBeDisabled();
  });

  it('shows the running total in amber when the splits do not match the bill total', () => {
    render(
      <BillingSubbar
        {...BASE_PROPS}
        paymentType="multiple"
        paymentSplits={[{ method: 'cash', amount: '100' }, { method: 'upi', amount: '100' }]}
        onPaymentSplitsChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('split-total')).toHaveClass('text-amber-600');
  });

  it('view mode renders the real per-method breakdown instead of the bare word "multiple"', () => {
    render(
      <BillingSubbar
        {...BASE_PROPS}
        viewMode="view"
        paymentType="multiple"
        paymentSplits={[{ method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }]}
      />,
    );

    const summary = screen.getByTestId('payment-split-summary');
    expect(summary).toHaveTextContent('Cash ₹300.00');
    expect(summary).toHaveTextContent('UPI ₹200.00');
    expect(screen.queryByText(/^multiple$/i)).not.toBeInTheDocument();
  });
});
