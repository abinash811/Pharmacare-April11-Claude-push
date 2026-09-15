import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import OutstandingDues from '../index';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 "Outstanding Dues" report — the
// consolidated "who owes us, how much" screen, built right after due-bill
// creation was reinstated the same day.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const REPORT = {
  summary: { total_outstanding: 1500, customer_count: 2, bill_count: 3 },
  customers: [
    {
      customer_id: 'cust-big', customer_name: 'Suresh Kumar', customer_phone: '9812345670',
      credit_limit: 0, outstanding: 1000, bill_count: 2, oldest_due_date: '2026-09-10', over_limit: false,
    },
    {
      customer_id: 'cust-small', customer_name: 'Priya Sharma', customer_phone: null,
      credit_limit: 500, outstanding: 500, bill_count: 1, oldest_due_date: '2026-09-14', over_limit: true,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <OutstandingDues />
    </MemoryRouter>,
  );
}

describe('OutstandingDues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: REPORT });
  });

  it('shows the real summary and customer rows, biggest debtor first', async () => {
    renderPage();
    expect(await screen.findByText('₹1,500.00')).toBeInTheDocument();
    const rows = await screen.findAllByRole('row');
    expect(rows[1]).toHaveTextContent('Suresh Kumar');
    expect(rows[2]).toHaveTextContent('Priya Sharma');
  });

  it('flags a customer over their credit limit', async () => {
    renderPage();
    await screen.findByText('Priya Sharma');
    expect(screen.getByText('Over limit')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is owed', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { summary: { total_outstanding: 0, customer_count: 0, bill_count: 0 }, customers: [] },
    });
    renderPage();
    expect(await screen.findByText('No outstanding dues')).toBeInTheDocument();
  });

  it('navigates to that customer\'s due bills on "View Bills"', async () => {
    renderPage();
    const buttons = await screen.findAllByRole('button', { name: 'View Bills' });
    await userEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/billing?filter=due&search=9812345670');
  });

  it('falls back to name for the drill-down search when a customer has no phone', async () => {
    renderPage();
    const buttons = await screen.findAllByRole('button', { name: 'View Bills' });
    await userEvent.click(buttons[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/billing?filter=due&search=Priya%20Sharma');
  });

  it('shows the real backend error reason when loading fails', async () => {
    (api.get as jest.Mock).mockRejectedValue({ message: 'Your role does not have permission to view reports' });
    renderPage();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Your role does not have permission to view reports');
    });
  });
});
