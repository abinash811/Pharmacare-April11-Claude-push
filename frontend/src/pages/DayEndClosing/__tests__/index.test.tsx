import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import DayEndClosing from '../index';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 "Day-End Closing / Z-Report"
// feature — Marg-validated gap, no cash-drawer reconciliation or
// per-operator sales summary existed anywhere in PharmaCare before this.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const REPORT = {
  date: '2026-09-15',
  summary: { total_bills: 2, total_sales: 300, total_returns: 50, net_sales: 250, expected_cash: 100 },
  payment_breakdown: [
    { payment_method: 'cash', sales_count: 1, sales_amount: 100, returns_count: 1, returns_amount: 50, net_amount: 50 },
    { payment_method: 'upi', sales_count: 1, sales_amount: 200, returns_count: 0, returns_amount: 0, net_amount: 200 },
  ],
  operator_breakdown: [{ operator_name: 'Admin User', bill_count: 2, sales_amount: 300 }],
  closing: null,
};

function renderPage(role = 'admin') {
  return render(
    <MemoryRouter initialEntries={['/reports/day-end']}>
      <AuthContext.Provider value={{ user: { role } } as any}>
        <DayEndClosing />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('DayEndClosing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: REPORT });
  });

  it('shows the real summary, payment breakdown, and operator breakdown', async () => {
    renderPage();
    expect(await screen.findByText('₹250.00')).toBeInTheDocument(); // Net Sales
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('shows the counted-cash form for an admin', async () => {
    renderPage('admin');
    expect(await screen.findByTestId('counted-cash-input')).toBeInTheDocument();
    expect(screen.getByTestId('expected-cash')).toHaveTextContent('₹100.00');
  });

  it('hides the counted-cash form for a non-admin and shows a plain note instead', async () => {
    renderPage('manager');
    await screen.findByText('Cash'); // wait for load
    expect(screen.queryByTestId('counted-cash-input')).not.toBeInTheDocument();
    expect(screen.getByText(/Only an admin can close the day/i)).toBeInTheDocument();
  });

  it('submits the counted cash and refreshes the report on success', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    renderPage('admin');
    const input = await screen.findByTestId('counted-cash-input');
    await userEvent.type(input, '95');
    await userEvent.click(screen.getByTestId('close-day-btn'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        'reports/day-end/close',
        expect.objectContaining({ closing_date: '2026-09-15', counted_cash: 95 }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Day closed');
  });

  it('shows the real backend error reason when close fails', async () => {
    (api.post as jest.Mock).mockRejectedValue({ message: 'Admin access required' });
    renderPage('admin');
    const input = await screen.findByTestId('counted-cash-input');
    await userEvent.type(input, '95');
    await userEvent.click(screen.getByTestId('close-day-btn'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Admin access required'));
  });

  it('shows the already-closed summary read-only when the day is already closed', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        ...REPORT,
        closing: {
          expected_cash: 100, counted_cash: 95, variance: -5, notes: 'Short by 5',
          closed_by_name: 'Admin User', closed_at: '2026-09-15T10:00:00Z',
        },
      },
    });
    renderPage('manager');
    expect(await screen.findByText('Short by 5')).toBeInTheDocument();
    expect(screen.getByText('Closed by Admin User')).toBeInTheDocument();
  });
});
