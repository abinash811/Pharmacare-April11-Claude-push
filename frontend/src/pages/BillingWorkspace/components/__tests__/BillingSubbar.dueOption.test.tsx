import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import BillingSubbar from '../BillingSubbar';

// Regression tests for the Sep 15, 2026 "Due" payment pill — reversing
// the Sep 14, 2026 removal. A due bill needs a real customer selected.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: [] }) },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const BASE_PROPS = {
  viewMode: 'new', billDate: new Date('2026-09-15'), onBillDateChange: jest.fn(),
  customerName: '', customerPhone: '', onPatientSelect: jest.fn(),
  doctorName: '', onDoctorChange: jest.fn(),
  paymentType: 'cash', onPaymentTypeChange: jest.fn(),
  paidNow: '', onPaidNowChange: jest.fn(),
};

describe('BillingSubbar — Due payment option', () => {
  beforeEach(() => jest.clearAllMocks());

  it('blocks picking Due when no customer is selected and does not call onPaymentTypeChange', async () => {
    const onPaymentTypeChange = jest.fn();
    render(<BillingSubbar {...BASE_PROPS} customerId={null} onPaymentTypeChange={onPaymentTypeChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Due' }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Pick a customer first'));
    expect(onPaymentTypeChange).not.toHaveBeenCalled();
  });

  it('allows picking Due when a real customer is selected', async () => {
    const onPaymentTypeChange = jest.fn();
    render(<BillingSubbar {...BASE_PROPS} customerId="cust-1" onPaymentTypeChange={onPaymentTypeChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Due' }));

    expect(toast.error).not.toHaveBeenCalled();
    expect(onPaymentTypeChange).toHaveBeenCalledWith('due');
  });

  it('shows the Paid Now field only when Due is the active payment type', () => {
    const { rerender } = render(<BillingSubbar {...BASE_PROPS} customerId="cust-1" paymentType="cash" />);
    expect(screen.queryByTestId('paid-now-input')).not.toBeInTheDocument();

    rerender(<BillingSubbar {...BASE_PROPS} customerId="cust-1" paymentType="due" />);
    expect(screen.getByTestId('paid-now-input')).toBeInTheDocument();
  });
});
