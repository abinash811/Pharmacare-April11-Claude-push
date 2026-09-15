import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import BillingOperations from '../BillingOperations';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 real Collect Payment row action —
// due bills only, replacing "no way to collect from the Billing list".

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }));

const DUE_BILL = {
  id: 'bill-due', bill_number: 'INV-000482', customer_name: 'Suresh Kumar',
  total_amount: 1240, due_amount: 1240, status: 'due', payment_method: 'due',
  created_at: '2026-09-15T02:26:00Z',
};
const PAID_BILL = {
  id: 'bill-paid', bill_number: 'INV-000481', customer_name: 'Priya Sharma',
  total_amount: 560, due_amount: 0, status: 'paid', payment_method: 'cash',
  created_at: '2026-09-15T01:10:00Z',
};

describe('BillingOperations — Collect Payment row action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [DUE_BILL, PAID_BILL], pagination: {} } });
  });

  it('shows the Collect Payment action only for the due bill', async () => {
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    await screen.findByText('#INV-000482');
    expect(screen.getByTestId('collect-payment-row-bill-due')).toBeInTheDocument();
    expect(screen.queryByTestId('collect-payment-row-bill-paid')).not.toBeInTheDocument();
  });

  it('opens the modal pre-filled and refreshes the list on success', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    await screen.findByText('#INV-000482');
    await userEvent.click(screen.getByTestId('collect-payment-row-bill-due'));

    expect(await screen.findByTestId('collect-amount-input')).toHaveValue(1240);
    await userEvent.click(screen.getByTestId('collect-payment-submit'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('payments', {
        invoice_id: 'bill-due', amount: 1240, payment_method: 'cash',
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Payment collected');
    // fetchData() re-runs on success — same list endpoint called again.
    await waitFor(() => expect((api.get as jest.Mock).mock.calls.length).toBeGreaterThan(1));
  });
});
