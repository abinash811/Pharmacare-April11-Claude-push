import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TransferHistory from '../TransferHistory';
import { AuthContext } from '@/App';
import api from '@/lib/axios';

// Regression tests for the Sep 28, 2026 fix (docs/15_ROADMAP.md RULE
// MISSES LOG): POST /stock-transfers/{id}/reverse was fully built and
// tested on the backend with zero frontend surface to reach it. This page
// is that surface — a history list (GET /stock-transfers, which already
// existed) plus an admin-only Reverse action.

jest.mock('@/App', () => ({
  AuthContext: require('react').createContext({ user: { name: 'Test User', role: 'admin' } }),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const TRANSFERS = [
  {
    id: 't1', transfer_number: 'TRF-2026-AAA111', source_pharmacy: 'Home Store',
    destination_pharmacy: 'Second Store', direction: 'out',
    transfer_date: '2026-09-28T10:00:00Z', is_cross_gstin: false, reversed: false,
  },
  {
    id: 't2', transfer_number: 'TRF-2026-BBB222', source_pharmacy: 'Second Store',
    destination_pharmacy: 'Home Store', direction: 'in',
    transfer_date: '2026-09-27T09:00:00Z', is_cross_gstin: false, reversed: true,
  },
];

function renderPage(role = 'admin') {
  // AuthContext is typed React.Context<null> in the real (plain-JS) App.js —
  // the value override here only matters at runtime, against the jest.mock
  // above, so `as any` is a test-only type bridge, not a real app type gap.
  return render(
    <AuthContext.Provider value={{ user: { name: 'Test User', role } } as any}>
      <MemoryRouter initialEntries={['/inventory/transfers']}>
        <Routes><Route path="/inventory/transfers" element={<TransferHistory />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('TransferHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists transfers with direction badges and status', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: TRANSFERS });
    renderPage();

    await waitFor(() => expect(screen.getByText('TRF-2026-AAA111')).toBeInTheDocument());
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Reversed')).toBeInTheDocument();
  });

  it('shows the empty state when there are no transfers', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No stock transfers yet/)).toBeInTheDocument());
  });

  it('shows Reverse only for an admin, only on a non-reversed transfer', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: TRANSFERS });
    renderPage('admin');

    await waitFor(() => expect(screen.getByTestId('reverse-transfer-t1')).toBeInTheDocument());
    expect(screen.queryByTestId('reverse-transfer-t2')).not.toBeInTheDocument();
  });

  it('hides Reverse entirely for a non-admin', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: TRANSFERS });
    renderPage('cashier');

    await waitFor(() => expect(screen.getByText('TRF-2026-AAA111')).toBeInTheDocument());
    expect(screen.queryByTestId('reverse-transfer-t1')).not.toBeInTheDocument();
  });

  it('reversing a transfer calls the API and refetches the list', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: TRANSFERS });
    (api.post as jest.Mock).mockResolvedValue({ data: { message: 'Transfer reversed' } });
    renderPage('admin');

    await waitFor(() => expect(screen.getByTestId('reverse-transfer-t1')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reverse-transfer-t1'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('stock-transfers/t1/reverse'));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('shows the real error reason when the list fails to load', async () => {
    const { toast } = require('sonner');
    (api.get as jest.Mock).mockRejectedValue({ message: 'Network error loading transfers' });
    renderPage();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error loading transfers'));
  });
});
