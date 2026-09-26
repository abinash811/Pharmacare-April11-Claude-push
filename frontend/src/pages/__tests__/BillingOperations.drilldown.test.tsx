import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillingOperations from '../BillingOperations';
import api from '@/lib/axios';

// Regression test for the Sep 14, 2026 Dashboard drill-down feature:
// BillingOperations must pre-apply ?filter= and ?from_date=/&to_date= from
// the URL on mount, so a Dashboard card lands here already filtered
// instead of on the full unfiltered bill list.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe('BillingOperations — drill-down URL params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [], pagination: {} } });
  });

  it('pre-selects the Parked filter pill when ?filter=parked is present', async () => {
    render(
      <MemoryRouter initialEntries={['/billing?filter=parked']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Parked', pressed: true })).toBeInTheDocument();
  });

  it('seeds the date range picker from ?from_date=&to_date=', async () => {
    render(
      <MemoryRouter initialEntries={['/billing?from_date=2026-09-01&to_date=2026-09-14']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/01 Sep 2026/)).toBeInTheDocument();
    expect(await screen.findByText(/14 Sep 2026/)).toBeInTheDocument();
  });

  it('defaults to the "All" filter with no query params', async () => {
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'All', pressed: true })).toBeInTheDocument();
  });

  // Sep 15, 2026: a customer-search drill-down (originally the Outstanding
  // Dues report's "View Bills" action, removed Sep 26, 2026 along with
  // due bills — kept as a general ?search= regression since other pages
  // could still drill into a customer's bills this way) seeds the search
  // box via ?search=, same pattern as ?filter=/&from_date=/&to_date= above.
  it('seeds the search box from ?search=', async () => {
    render(
      <MemoryRouter initialEntries={['/billing?search=9812345670']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    expect(await screen.findByDisplayValue('9812345670')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('search=9812345670'));
  });
});
