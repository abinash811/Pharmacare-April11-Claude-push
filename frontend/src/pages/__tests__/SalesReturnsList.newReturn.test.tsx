import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SalesReturnsList from '../SalesReturnsList';
import api from '@/lib/axios';

// Regression test for the Sep 23, 2026 inline bill picker: "New Return"
// now goes straight to /billing/returns/new, which itself shows an inline
// bill search (BillPicker) since every return must start from a real
// bill — no detour through the Billing page is needed anymore.

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

describe('SalesReturnsList — New Return opens the return page directly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [], pagination: {} } });
  });

  it('navigates to /billing/returns/new when clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/billing/returns']}>
        <SalesReturnsList />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByTestId('new-return-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/billing/returns/new');
  });

  it('the empty-state button does the same', async () => {
    render(
      <MemoryRouter initialEntries={['/billing/returns']}>
        <SalesReturnsList />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByTestId('empty-new-return-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/billing/returns/new');
  });
});
