import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import BillDetail from '../index';
import api from '@/lib/axios';

// Regression test for the Sep 15, 2026 fix: GET /bills/{id}/pdf (real,
// working, reportlab-generated) had zero UI caller anywhere in the app.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const BILL = {
  id: 'bill-1', bill_number: 'INV-000001', status: 'paid', customer_name: 'Walk-in Test Customer',
  items: [], created_at: '2026-09-15T02:26:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/billing/bill-1']}>
      <Routes>
        <Route path="/billing/:id" element={<BillDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BillDetail — Download PDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  it('downloads the real bill PDF', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/pdf')) return Promise.resolve({ data: 'pdf-bytes' });
      if (url.includes('/settings')) return Promise.resolve({ data: { general: {} } });
      return Promise.resolve({ data: BILL });
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();

    const btn = await screen.findByTestId('download-pdf-btn');
    await userEvent.click(btn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/pdf'), { responseType: 'blob' });
    });
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('shows the real backend reason when the download fails', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/pdf')) {
        const blob = new Blob([JSON.stringify({ detail: 'Bill not found' })], { type: 'application/json' });
        return Promise.reject({ response: { data: blob }, message: 'Request failed with status code 404' });
      }
      if (url.includes('/settings')) return Promise.resolve({ data: { general: {} } });
      return Promise.resolve({ data: BILL });
    });
    renderPage();

    const btn = await screen.findByTestId('download-pdf-btn');
    await userEvent.click(btn);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bill not found'));
  });
});
