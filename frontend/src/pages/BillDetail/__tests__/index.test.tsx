import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BillDetail from '../index';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 product-review finding: a
// finalized (paid/due) bill had no return entry point at all — "Return
// Items" is the real, direct fix.
//
// "Edit Bill" was hidden for paid/due bills until Sep 18, 2026, when the
// same-day bill-edit policy (docs/15_ROADMAP.md's Billing table) shipped:
// a paid/due bill can now be corrected until that day's Day-End Closing
// runs, so the button always shows — the backend is the real gate and
// returns a clear reason (return exists / day closed) if it's too late.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function mockBill(overrides = {}) {
  return {
    id: 'bill-1', bill_number: 'INV-000001', status: 'due', items: [],
    customer_name: 'Suresh Kumar', due_amount: 200, paid_amount: 0, total_amount: 200,
    created_at: '2026-09-15T10:00:00Z',
    ...overrides,
  };
}

function renderPage(bill: ReturnType<typeof mockBill>) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('settings')) return Promise.resolve({ data: { general: {} } });
    return Promise.resolve({ data: bill });
  });
  return render(
    <MemoryRouter initialEntries={['/billing/bill-1']}>
      <Routes>
        <Route path="/billing/:id" element={<BillDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BillDetail — Return Items entry point', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "Return Items" for a due bill and navigates with the billId', async () => {
    renderPage(mockBill({ status: 'due' }));
    const btn = await screen.findByTestId('return-items-btn');
    btn.click();
    expect(mockNavigate).toHaveBeenCalledWith('/billing/returns/new?billId=bill-1');
  });

  it('shows "Return Items" for a fully paid bill too', async () => {
    renderPage(mockBill({ status: 'paid', due_amount: 0 }));
    expect(await screen.findByTestId('return-items-btn')).toBeInTheDocument();
  });

  it('does not show "Return Items" for a parked/draft bill', async () => {
    renderPage(mockBill({ status: 'draft', bill_number: 'DRAFT-001' }));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('return-items-btn')).not.toBeInTheDocument();
  });

  it('shows "Edit Bill" for a due bill (same-day correction, per the Sep 18 2026 policy)', async () => {
    renderPage(mockBill({ status: 'due' }));
    await screen.findByTestId('return-items-btn');
    expect(screen.queryByText('Edit Bill')).toBeInTheDocument();
  });

  it('shows "Edit Bill" for a paid bill too', async () => {
    renderPage(mockBill({ status: 'paid', due_amount: 0 }));
    await screen.findByTestId('return-items-btn');
    expect(screen.queryByText('Edit Bill')).toBeInTheDocument();
  });

  it('shows "Edit Bill" for a parked/draft bill (unaffected — always could be edited)', async () => {
    renderPage(mockBill({ status: 'draft', bill_number: 'DRAFT-001' }));
    expect(await screen.findByText('Edit Bill')).toBeInTheDocument();
  });
});
