import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PurchasesList from '../PurchasesList';
import api from '@/lib/axios';

// Regression test for the Sep 14, 2026 Dashboard drill-down feature:
// PurchasesList must pre-apply ?from_date=/&to_date= from the URL on
// mount, so the Dashboard's Purchases/Net Purchases (Month) cards land
// here already scoped to the same month they counted.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe('PurchasesList — drill-down URL params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('suppliers')
        ? Promise.resolve({ data: [] })
        : Promise.resolve({ data: { data: [], pagination: {} } }));
  });

  it('seeds the date range picker from ?from_date=&to_date=', async () => {
    render(
      <MemoryRouter initialEntries={['/purchases?from_date=2026-09-01&to_date=2026-09-14']}>
        <PurchasesList />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/01 Sep 2026/)).toBeInTheDocument();
    expect(await screen.findByText(/14 Sep 2026/)).toBeInTheDocument();
  });
});
