import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GSTReport from '../GSTReport';
import api from '@/lib/axios';

// Regression tests for the Sep 27, 2026 multi-chain Phase 2, Step 6b
// (docs/26_MULTI_CHAIN_SCOPE.md Section 6 #6): the GST report's This
// Store / All Stores toggle, same pattern as Dashboard's own toggle.

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

const REPORT_DATA = {
  sales: [{ gst_rate: 12, taxable_amount: 1000, cgst: 60, sgst: 60, igst: 0, total_gst: 120 }],
  purchases: [{ gst_rate: 12, taxable_amount: 500, cgst: 30, sgst: 30, igst: 0, total_gst: 60 }],
  sales_summary: { total_taxable: 1000, cgst: 60, sgst: 60, igst: 0, total_gst: 120 },
  purchases_summary: { total_taxable: 500, cgst: 30, sgst: 30, igst: 0, total_gst: 60, cess: 0 },
  net_liability: 60,
  period: { start_date: '2026-09-01', end_date: '2026-09-27' },
  scope: 'store',
  store_count: 1,
};

function mockApiGet(stores: Array<{ pharmacy_id: string; name: string }>) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.startsWith('reports/gst')) {
      const scope = url.includes('scope=chain') ? 'chain' : 'store';
      return Promise.resolve({
        data: { ...REPORT_DATA, scope, store_count: scope === 'chain' ? stores.length : 1 },
      });
    }
    return Promise.resolve({ data: stores });
  });
}

describe('GSTReport multi-store scope toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides the store/chain toggle for a single-store account', async () => {
    mockApiGet([{ pharmacy_id: 'p1', name: 'Only Store' }]);
    render(<MemoryRouter><GSTReport /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText('All Stores')).not.toBeInTheDocument();
  });

  it('shows the toggle for a chain account and requests scope=chain on click', async () => {
    mockApiGet([{ pharmacy_id: 'p1', name: 'Store A' }, { pharmacy_id: 'p2', name: 'Store B' }]);
    render(<MemoryRouter><GSTReport /></MemoryRouter>);

    await userEvent.click(await screen.findByTestId('generate-report-btn'));
    await waitFor(() => expect(screen.getByText('GST Summary')).toBeInTheDocument());

    await userEvent.click(screen.getByText('All Stores'));

    await waitFor(() => expect(api.get as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining('scope=chain')));
    expect(await screen.findByText(/Combined across 2 stores/)).toBeInTheDocument();
  });
});
