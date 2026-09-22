import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BillDetail from '../index';
import api from '@/lib/axios';

// Regression tests for the Sep 22, 2026 fix: BillDetail's thermal view had
// no GST-summary table at all (unlike its own A4 view, which has one via
// BillTotals.jsx), and neither view actually read the "Print GST summary
// table" toggle — it lives under settings.gst, not settings.print, which
// this page never fetched. The A4 view's table rendered unconditionally
// whenever there was GST data, regardless of the setting.

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
    id: 'bill-1', bill_number: 'INV-000300', status: 'paid',
    customer_name: 'Suresh Kumar', due_amount: 0, paid_amount: 236, total_amount: 236,
    created_at: '2026-09-22T10:00:00Z',
    items: [
      { id: 'i1', product_name: 'Amoxicillin', quantity: 2, gst_percent: 5, line_total: 105 },
      { id: 'i2', product_name: 'Vitamin D3', quantity: 1, gst_percent: 18, line_total: 118 },
    ],
    ...overrides,
  };
}

function renderPage(paperSize: string, printGstSummary: boolean | undefined) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('settings')) {
      return Promise.resolve({
        data: {
          general: {},
          print: { paper_size: paperSize },
          gst: printGstSummary === undefined ? {} : { print_gst_summary: printGstSummary },
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

describe('BillDetail — GST summary table', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the GST summary on the thermal view when the toggle is on', async () => {
    renderPage('80mm', true);
    expect(await screen.findByText('GST Summary')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument();
  });

  it('hides the GST summary on the thermal view when the toggle is off', async () => {
    renderPage('80mm', false);
    await screen.findByTestId('bill-view-thermal');
    expect(screen.queryByText('GST Summary')).not.toBeInTheDocument();
  });

  it('defaults to showing the GST summary when settings.gst is empty', async () => {
    renderPage('80mm', undefined);
    expect(await screen.findByText('GST Summary')).toBeInTheDocument();
  });

  it('hides the A4 view\'s GST Breakup table when the toggle is off (previously ungated)', async () => {
    renderPage('a4', false);
    await screen.findByTestId('bill-view-a4');
    expect(screen.queryByText('GST Breakup')).not.toBeInTheDocument();
  });

  it('still shows the A4 view\'s GST Breakup table when the toggle is on', async () => {
    renderPage('a4', true);
    expect(await screen.findByText('GST Breakup')).toBeInTheDocument();
  });
});
