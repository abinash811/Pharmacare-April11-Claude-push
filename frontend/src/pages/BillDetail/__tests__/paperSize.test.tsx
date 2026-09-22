import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BillDetail from '../index';
import api from '@/lib/axios';

// Regression tests for the Sep 22, 2026 Receipt & Print product-review
// finding: BillDetail's on-screen Print/Download always rendered the wide
// A4-style card regardless of Settings > Receipt & Print > Paper Size, so
// an 80mm/58mm-thermal pharmacy's reprint never matched their original
// Save & Print. ThermalBillView now renders instead for those two sizes.

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

function renderPage(paperSize: string | undefined) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('settings')) {
      return Promise.resolve({
        data: { general: {}, print: paperSize ? { paper_size: paperSize } : {} },
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

describe('BillDetail — paper-size-aware layout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the thermal receipt for an 80mm-configured pharmacy', async () => {
    renderPage('80mm');
    expect(await screen.findByTestId('bill-view-thermal')).toBeInTheDocument();
    expect(screen.queryByTestId('bill-view-a4')).not.toBeInTheDocument();
  });

  it('renders the thermal receipt for a 58mm-configured pharmacy', async () => {
    renderPage('58mm');
    expect(await screen.findByTestId('bill-view-thermal')).toBeInTheDocument();
    expect(screen.queryByTestId('bill-view-a4')).not.toBeInTheDocument();
  });

  it('renders the full tax invoice for an a4-configured pharmacy', async () => {
    renderPage('a4');
    expect(await screen.findByTestId('bill-view-a4')).toBeInTheDocument();
    expect(screen.queryByTestId('bill-view-thermal')).not.toBeInTheDocument();
  });

  it('renders the full tax invoice for an a5-configured pharmacy', async () => {
    renderPage('a5');
    expect(await screen.findByTestId('bill-view-a4')).toBeInTheDocument();
    expect(screen.queryByTestId('bill-view-thermal')).not.toBeInTheDocument();
  });

  it('falls back to the full tax invoice when print settings failed to load', async () => {
    renderPage(undefined);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(await screen.findByTestId('bill-view-a4')).toBeInTheDocument();
  });
});
