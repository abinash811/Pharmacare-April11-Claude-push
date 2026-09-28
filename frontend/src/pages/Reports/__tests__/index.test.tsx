import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Reports from '../index';
import { useReports } from '../hooks/useReports';
import api from '@/lib/axios';

// Regression tests for the Sep 28, 2026 multi-chain persona audit
// (docs/15_ROADMAP.md RULE MISSES LOG): only Dashboard and GST Report have
// a chain-wide "All Stores" rollup — every other report type here still
// only ever shows the caller's own active store, with nothing on screen
// saying so. This note is the fix.

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));
jest.mock('../hooks/useReports');

describe('Reports — chain-scope boundary note', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useReports as jest.Mock).mockReturnValue({
      loading: false, reportData: null,
      dateRange: { start: null, end: null }, setDateRange: jest.fn(),
      expiryDays: 30, setExpiryDays: jest.fn(),
      fetchReport: jest.fn(), handleRefresh: jest.fn(),
      handleExportCSV: jest.fn(), handleExportExcel: jest.fn(),
    });
  });

  it('hides the note for a single-store account', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [{ pharmacy_id: 'p1', name: 'Only Store' }] });
    render(<Reports />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('reports-chain-scope-note')).not.toBeInTheDocument();
  });

  it('shows the note once the account has more than one store', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ pharmacy_id: 'p1', name: 'Store A' }, { pharmacy_id: 'p2', name: 'Store B' }],
    });
    render(<Reports />);
    await waitFor(() => expect(screen.getByTestId('reports-chain-scope-note')).toBeInTheDocument());
    expect(screen.getByText(/Dashboard and GST Report have it/)).toBeInTheDocument();
  });
});
