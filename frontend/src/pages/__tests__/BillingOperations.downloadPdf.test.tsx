import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import BillingOperations from '../BillingOperations';
import api from '@/lib/axios';

// Regression test for the Sep 15, 2026 fix: the list row's "Print" button
// used to be a pure stub (toast.info only, no real action). It now
// downloads the real bill PDF via GET /bills/{id}/pdf.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }));

const BILL = {
  id: 'bill-1', bill_number: 'INV-000001', customer_name: 'Walk-in Test Customer',
  total_amount: 112, payment_method: 'cash', created_at: '2026-09-15T02:26:00Z',
};

describe('BillingOperations — Download PDF row action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  it('downloads the real PDF instead of showing a fake "Printing..." toast', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/pdf')) return Promise.resolve({ data: 'pdf-bytes' });
      return Promise.resolve({ data: { data: [BILL], pagination: {} } });
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    const btn = await screen.findByRole('button', { name: 'Download PDF' });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/pdf'), { responseType: 'blob' });
    });
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('shows the real backend reason, not a generic message, when the download fails', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/pdf')) {
        const blob = new Blob([JSON.stringify({ detail: 'Bill not found' })], { type: 'application/json' });
        return Promise.reject({ response: { data: blob }, message: 'Request failed with status code 404' });
      }
      return Promise.resolve({ data: { data: [BILL], pagination: {} } });
    });
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <BillingOperations />
      </MemoryRouter>,
    );
    const btn = await screen.findByRole('button', { name: 'Download PDF' });
    await userEvent.click(btn);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bill not found'));
  });
});
