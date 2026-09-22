import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BillDetail from '../index';
import api from '@/lib/axios';

// Regression test for a bug found live (Sep 22, 2026) while verifying the
// paper-size fix: A4BillView/ThermalBillView read `pharmacy.drug_license`,
// but GET /settings' real "general" field is `drug_license_number` — so
// "Drug Lic:"/"DL:" never rendered on BillDetail for any pharmacy, even
// with the Show-on-Bill toggle on and a real value set. The backend PDF
// (routers/billing.py) already used the correct field name; only this
// on-screen preview had the mismatch.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

function mockBill(overrides = {}) {
  return {
    id: 'bill-1', bill_number: 'INV-000001', status: 'paid', items: [],
    customer_name: 'Suresh Kumar', due_amount: 0, paid_amount: 200, total_amount: 200,
    created_at: '2026-09-22T10:00:00Z',
    ...overrides,
  };
}

function renderPage(paperSize: string) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('settings')) {
      return Promise.resolve({
        data: {
          general: { pharmacy_name: 'Test Pharmacy', drug_license_number: 'KA-BLR-99999' },
          print: { paper_size: paperSize, print_drug_license: true },
        },
      });
    }
    return Promise.resolve({ data: mockBill() });
  });
  return render(
    <MemoryRouter initialEntries={['/billing/bill-1']}>
      <Routes>
        <Route path="/billing/:id" element={<BillDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BillDetail — Drug License field name', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the real Drug License number on the A4 view', async () => {
    renderPage('a4');
    expect(await screen.findByText(/KA-BLR-99999/)).toBeInTheDocument();
  });

  it('shows the real Drug License number on the thermal view', async () => {
    renderPage('80mm');
    expect(await screen.findByText(/KA-BLR-99999/)).toBeInTheDocument();
  });
});
