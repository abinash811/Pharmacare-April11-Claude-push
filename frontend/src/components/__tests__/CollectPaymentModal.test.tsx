import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import CollectPaymentModal from '../CollectPaymentModal';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 real Collect Payment UI (replacing
// the "Collect payment coming soon" stub), shared by BillDetail and
// BillingOperations.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const BILL = {
  id: 'bill-1', bill_number: 'INV-000482', customer_name: 'Suresh Kumar',
  total_amount: 1240, due_amount: 1240, created_at: '2026-09-15T06:00:00Z',
};

describe('CollectPaymentModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pre-fills the full due amount and defaults to Cash', () => {
    render(<CollectPaymentModal bill={BILL} open onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByTestId('collect-amount-input')).toHaveValue(1240);
  });

  it('submits the amount and method to POST /payments and calls onSuccess', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    render(<CollectPaymentModal bill={BILL} open onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByTestId('collect-payment-submit'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('payments', {
        invoice_id: 'bill-1', amount: 1240, payment_method: 'cash',
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Payment collected');
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('allows a partial amount and a different method', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    render(<CollectPaymentModal bill={BILL} open onClose={jest.fn()} onSuccess={jest.fn()} />);

    const input = screen.getByTestId('collect-amount-input');
    await userEvent.clear(input);
    await userEvent.type(input, '500');
    await userEvent.click(screen.getByRole('button', { name: 'UPI' }));
    await userEvent.click(screen.getByTestId('collect-payment-submit'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('payments', {
        invoice_id: 'bill-1', amount: 500, payment_method: 'upi',
      });
    });
  });

  it('shows the real backend error reason when collection fails', async () => {
    (api.post as jest.Mock).mockRejectedValue({ message: 'This bill is not due — there is nothing to collect.' });
    render(<CollectPaymentModal bill={BILL} open onClose={jest.fn()} onSuccess={jest.fn()} />);

    await userEvent.click(screen.getByTestId('collect-payment-submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('This bill is not due — there is nothing to collect.');
    });
  });

  it('renders nothing when no bill is passed', () => {
    const { container } = render(<CollectPaymentModal bill={null} open onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
