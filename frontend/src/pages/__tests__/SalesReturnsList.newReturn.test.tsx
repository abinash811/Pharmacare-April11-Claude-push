import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SalesReturnsList from '../SalesReturnsList';
import api from '@/lib/axios';

// Regression test for the Sep 23, 2026 removal of manual (no-original-bill)
// returns: "New Return" used to open a blank return form (gated behind the
// allow_manual_returns permission). Every return must now start from a
// real bill, so the button sends the cashier to Billing to find one
// instead — this page never navigates to /billing/returns/new itself.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), info: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('SalesReturnsList — New Return sends the user to Billing, not a blank form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [], pagination: {} } });
  });

  it('navigates to /billing, never /billing/returns/new, when clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/billing/returns']}>
        <SalesReturnsList />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByTestId('new-return-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/billing');
    expect(mockNavigate).not.toHaveBeenCalledWith('/billing/returns/new');
  });

  it('the empty-state button does the same', async () => {
    render(
      <MemoryRouter initialEntries={['/billing/returns']}>
        <SalesReturnsList />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByTestId('empty-new-return-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/billing');
    expect(mockNavigate).not.toHaveBeenCalledWith('/billing/returns/new');
  });
});
