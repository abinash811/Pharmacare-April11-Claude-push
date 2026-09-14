import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PurchaseReturnsList from '../PurchaseReturnsList';
import api from '@/lib/axios';

// Regression test for the Sep 14, 2026 Dashboard drill-down feature:
// PurchaseReturnsList must pre-apply ?from_date=/&to_date= from the URL
// on mount, so the Dashboard's "Purchase Returns (Month)" card lands here
// already scoped to the same month it counted.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe('PurchaseReturnsList — drill-down URL params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('seeds the date range picker from ?from_date=&to_date=', async () => {
    render(
      <MemoryRouter initialEntries={['/purchases/returns?from_date=2026-09-01&to_date=2026-09-14']}>
        <PurchaseReturnsList />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/01 Sep 2026/)).toBeInTheDocument();
    expect(await screen.findByText(/14 Sep 2026/)).toBeInTheDocument();
  });
});
