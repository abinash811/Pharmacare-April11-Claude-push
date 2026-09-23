import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import SalesReturnCreate from '../index';
import api from '@/lib/axios';

// Jest hoists jest.mock() above every import, so the factory can't close
// over a module-scope `createContext` import — it has to require() react
// itself, lazily, inside the factory.
jest.mock('@/App', () => ({
  AuthContext: require('react').createContext({ user: { name: 'Admin User', role: 'admin' } }),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// jsdom (this test env) has no crypto.randomUUID — the component calls it
// per return item when mapping the fetched bill's items.
const testCrypto = (window.crypto || {}) as { randomUUID?: () => string };
if (!testCrypto.randomUUID) {
  let n = 0;
  testCrypto.randomUUID = () => `test-uuid-${n++}`;
  Object.defineProperty(window, 'crypto', { value: testCrypto, configurable: true });
}

// Regression tests for the Sep 15, 2026 rebuild: a return against a bill
// that still has money owed on it always credits that balance first — no
// refund-method choice for the cashier — and "Credit to Account" is no
// longer offered once there's nothing left to credit (it used to be a
// decorative option with zero real effect).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const BILL_ITEM = {
  product_id: 'prod-1', product_name: 'Paracetamol 500mg', product_sku: 'PARA-500',
  batch_id: 'batch-1', batch_no: 'B001', expiry_date: '2028-01-01',
  mrp: 100, unit_price: 100, quantity: 5, discount_percent: 0, gst_percent: 0,
};

function mockBill(overrides = {}) {
  return {
    id: 'bill-1', bill_number: 'INV-000001', status: 'due', due_amount: 200,
    customer_id: 'cust-1', customer_name: 'Suresh Kumar', customer_mobile: '9812345670',
    payment_method: null, doctor_name: '', items: [BILL_ITEM],
    ...overrides,
  };
}

function renderPage(bill: ReturnType<typeof mockBill>) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/users')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: bill });
  });
  return render(
    <MemoryRouter initialEntries={['/billing/returns/new?billId=bill-1']}>
      <SalesReturnCreate />
    </MemoryRouter>,
  );
}

describe('SalesReturnCreate — due-balance credit UX', () => {
  beforeEach(() => jest.clearAllMocks());

  it('auto-credits the due balance and hides the refund-method choice when the return does not exceed it', async () => {
    // due = 200, returning all 5 units @ 100 = 500... use qty within due:
    // load with a smaller original bill quantity so net stays under due.
    renderPage(mockBill({ due_amount: 1000, items: [{ ...BILL_ITEM, quantity: 5 }] }));
    expect(await screen.findByTestId('credit-to-balance-note')).toHaveTextContent('credited to due balance');
    expect(screen.queryByTestId('refund-method')).not.toBeInTheDocument();
  });

  it('shows only Cash/UPI/Same as Original (no Credit to Account) once the bill has no due balance', async () => {
    renderPage(mockBill({ status: 'paid', due_amount: 0 }));
    const select = await screen.findByTestId('refund-method');
    expect(select).toBeInTheDocument();
    expect(screen.queryByText('Credit to Account')).not.toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();
    expect(screen.getByText('Same as Original')).toBeInTheDocument();
  });

  it('shows both the credit note and a refund-method choice when the return exceeds the due balance', async () => {
    // due = 100, returning 5 units @ 100 = 500 -> 100 credited, 400 excess.
    renderPage(mockBill({ due_amount: 100 }));
    expect(await screen.findByTestId('credit-to-balance-note')).toBeInTheDocument();
    expect(screen.getByTestId('refund-method')).toBeInTheDocument();
  });
});

// Regression tests for the Sep 23, 2026 removal of manual (no-billId)
// returns: every return must now originate from a real bill. A direct hit
// on this route with no billId is a dead link, not a blank return form.
describe('SalesReturnCreate — no billId is redirected, not a blank form', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error and redirects to the returns list instead of rendering a blank form', async () => {
    render(
      <MemoryRouter initialEntries={['/billing/returns/new']}>
        <SalesReturnCreate />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/billing/returns'));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('must be started from a bill'),
    );
    expect(api.get).not.toHaveBeenCalled();
  });
});
