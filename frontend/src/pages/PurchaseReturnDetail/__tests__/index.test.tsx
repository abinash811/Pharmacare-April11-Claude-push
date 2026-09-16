import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PurchaseReturnDetail from '../index';
import api from '@/lib/axios';

jest.mock('@/App', () => ({
  AuthContext: require('react').createContext({ user: { name: 'Admin User', role: 'admin' } }),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

// Regression tests for the Sep 15, 2026 Purchase Returns build: (1) the
// return's real reason (found nowhere in the UI before) now displays on
// detail; (2) a failed fetch used to run `catch { ... }` with no `err`
// binding at all (so it was structurally impossible to show a real
// reason), and the credit-status/edit-save catches read
// err.response?.data?.detail directly instead of the normalized
// err.message.

const RETURN = {
  id: 'ret-1', return_number: 'PRET-2026-0001', status: 'confirmed',
  supplier_name: 'Test Distributors', purchase_number: 'PUR-2026-0001',
  return_date: '2026-09-15', billed_by: 'Admin User', reason: 'near_expiry',
  ptr_total: 250, gst_amount: 30, total_value: 280,
  credit_status: 'pending', credit_received: 0, credit_owed: 280,
  items: [{ id: 'i1', product_name: 'Paracetamol 500mg', product_sku: 'PARA-500',
    batch_no: 'B001', expiry_date: '2028-01-01', mrp: 100, qty_units: 5,
    ptr: 50, gst_percent: 12, line_total: 280 }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/purchases/returns/ret-1']}>
      <Routes><Route path="/purchases/returns/:id" element={<PurchaseReturnDetail />} /></Routes>
    </MemoryRouter>,
  );
}

describe('PurchaseReturnDetail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the return reason as a readable label', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/users')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: RETURN });
    });
    renderPage();
    expect(await screen.findByText('Near expiry')).toBeInTheDocument();
  });

  it('does not show a reason label when no reason is present', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/users')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { ...RETURN, reason: null } });
    });
    renderPage();
    await screen.findAllByText(RETURN.return_number);
    expect(screen.queryByText('Near expiry')).not.toBeInTheDocument();
  });
});
