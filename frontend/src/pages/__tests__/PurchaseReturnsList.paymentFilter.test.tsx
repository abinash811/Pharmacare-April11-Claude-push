import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PurchaseReturnsList from '../PurchaseReturnsList';
import api from '@/lib/axios';

// Regression test for the Sep 16, 2026 fix (Purchase Returns
// product-review, PR12): the Credit/Cash/UPI filter pills here compare
// against `ret.payment_type` client-side, but that key never existed in
// GET /purchase-returns's response until this fix — so selecting any
// filter other than "All" always matched zero rows, silently, for every
// pharmacy. This test would have failed against the pre-fix mock data
// (which now includes payment_type, matching the real fixed API shape).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const RETURNS = [
  { id: 'ret-credit', return_number: 'PRET-2026-0001', supplier_name: 'Distributor A', payment_type: 'credit', total_value: 100, credit_status: 'pending' },
  { id: 'ret-cash', return_number: 'PRET-2026-0002', supplier_name: 'Distributor B', payment_type: 'cash', total_value: 200, credit_status: 'pending' },
];

describe('PurchaseReturnsList — payment type filter pills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: RETURNS });
  });

  it('shows all returns under "All"', async () => {
    render(<MemoryRouter><PurchaseReturnsList /></MemoryRouter>);
    expect(await screen.findByText('PRET-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('PRET-2026-0002')).toBeInTheDocument();
  });

  it('filters to only credit returns when Credit is selected', async () => {
    render(<MemoryRouter><PurchaseReturnsList /></MemoryRouter>);
    await screen.findByText('PRET-2026-0001');
    await userEvent.click(screen.getByText('Credit'));
    expect(screen.getByText('PRET-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('PRET-2026-0002')).not.toBeInTheDocument();
  });

  it('filters to only cash returns when Cash is selected', async () => {
    render(<MemoryRouter><PurchaseReturnsList /></MemoryRouter>);
    await screen.findByText('PRET-2026-0001');
    await userEvent.click(screen.getByText('Cash'));
    expect(screen.getByText('PRET-2026-0002')).toBeInTheDocument();
    expect(screen.queryByText('PRET-2026-0001')).not.toBeInTheDocument();
  });
});
