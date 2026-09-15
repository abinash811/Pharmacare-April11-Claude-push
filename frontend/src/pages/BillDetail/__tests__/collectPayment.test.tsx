import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import BillDetail from '../index';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 real Collect Payment button on
// BillDetail — shown only for a due bill, refetches the bill on success.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const DUE_BILL = {
  id: 'bill-1', bill_number: 'INV-000482', status: 'due', customer_name: 'Suresh Kumar',
  total_amount: 1240, due_amount: 1240, items: [], created_at: '2026-09-15T02:26:00Z',
};
const PAID_BILL = { ...DUE_BILL, status: 'paid', due_amount: 0 };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/billing/bill-1']}>
      <Routes>
        <Route path="/billing/:id" element={<BillDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BillDetail — Collect Payment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the Collect Payment button for a due bill', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/settings')) return Promise.resolve({ data: { general: {} } });
      return Promise.resolve({ data: DUE_BILL });
    });
    renderPage();
    expect(await screen.findByTestId('collect-payment-btn')).toBeInTheDocument();
  });

  it('hides the Collect Payment button for a paid bill', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/settings')) return Promise.resolve({ data: { general: {} } });
      return Promise.resolve({ data: PAID_BILL });
    });
    renderPage();
    await screen.findByTestId('download-pdf-btn');
    expect(screen.queryByTestId('collect-payment-btn')).not.toBeInTheDocument();
  });

  it('collects payment and refetches the bill, which then flips to paid', async () => {
    (api.get as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve({ data: DUE_BILL })) // initial bill load
      .mockImplementationOnce(() => Promise.resolve({ data: { general: {} } })) // settings load
      .mockImplementationOnce(() => Promise.resolve({ data: PAID_BILL })); // refetch after payment
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    renderPage();

    const btn = await screen.findByTestId('collect-payment-btn');
    await userEvent.click(btn);
    await userEvent.click(await screen.findByTestId('collect-payment-submit'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Payment collected'));
    await waitFor(() => expect(screen.queryByTestId('collect-payment-btn')).not.toBeInTheDocument());
  });
});
