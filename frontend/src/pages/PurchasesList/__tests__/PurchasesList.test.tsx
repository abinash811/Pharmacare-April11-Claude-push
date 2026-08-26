import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PurchasesList from '../index';
import api from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockedGet = api.get as jest.Mock;

const CASH_PURCHASE = {
  id: 'p1', purchase_number: '#PUR-2026-0001', purchase_date: '2026-08-26',
  status: 'confirmed', payment_status: 'unpaid', purchase_on: 'cash',
  supplier_name: 'Manly Suppliers', total_value: 116, amount_paid: 0,
};

const setupMocks = (purchases = [CASH_PURCHASE]) => {
  mockedGet.mockImplementation((url: string) => {
    if (url.startsWith('suppliers')) return Promise.resolve({ data: { data: [] } });
    if (url.startsWith('purchases')) {
      return Promise.resolve({
        data: { data: purchases, pagination: { page: 1, page_size: 20, total: purchases.length, total_pages: 1 } },
      });
    }
    return Promise.resolve({ data: {} });
  });
};

const renderPage = () => render(<MemoryRouter><PurchasesList /></MemoryRouter>);

describe('PurchasesList — payment filter dropdown', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a single dropdown instead of pills, defaulting to All', async () => {
    setupMocks();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('payment-filter-select')).toBeInTheDocument());
    expect(screen.getByTestId('payment-filter-select')).toHaveValue('all');
  });

  it('sends purchase_on=cash when Cash is selected', async () => {
    setupMocks();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('payment-filter-select')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByTestId('payment-filter-select'), 'cash');

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(
      expect.stringMatching(/purchases\?.*purchase_on=cash/),
    ));
  });

  it('sends payment_status=unpaid when Due is selected', async () => {
    setupMocks();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('payment-filter-select')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByTestId('payment-filter-select'), 'due');

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(
      expect.stringMatching(/purchases\?.*payment_status=unpaid/),
    ));
  });

  it('shows the Cash badge for an unpaid cash purchase (regression: list rows now carry purchase_on)', async () => {
    setupMocks();
    renderPage();
    await waitFor(() => expect(screen.getByText('Manly Suppliers')).toBeInTheDocument());
    const table = within(screen.getByTestId('purchases-table'));
    expect(table.getByText('Cash')).toBeInTheDocument();
    expect(table.queryByText('Due')).not.toBeInTheDocument();
  });
});
