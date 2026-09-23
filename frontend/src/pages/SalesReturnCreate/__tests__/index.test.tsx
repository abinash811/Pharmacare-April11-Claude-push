import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

// Regression tests for the Sep 23, 2026 inline bill picker: every return
// must originate from a real bill, and — per direct instruction — picking
// that bill now happens inline on this page (BillPicker) instead of
// sending the cashier away to find one in Billing first.
describe('SalesReturnCreate — no billId shows the inline bill picker', () => {
  beforeEach(() => jest.clearAllMocks());

  const BILLS = [
    { id: 'bill-paid', bill_number: 'INV-000005', status: 'paid', payment_method: 'cash', customer_name: 'Ravi Kumar', bill_date: '2026-09-20', total_amount: 250 },
    { id: 'bill-due', bill_number: 'INV-000006', status: 'due', payment_method: null, customer_name: 'Anita Rao', bill_date: '2026-09-21', total_amount: 500 },
    { id: 'bill-draft', bill_number: 'INV-000007', status: 'draft', payment_method: null, customer_name: 'Draft Guy', bill_date: '2026-09-22', total_amount: 100 },
  ];

  function renderPicker() {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('bills')) return Promise.resolve({ data: { data: BILLS } });
      return Promise.resolve({ data: [] });
    });
    return render(
      <MemoryRouter initialEntries={['/billing/returns/new']}>
        <SalesReturnCreate />
      </MemoryRouter>,
    );
  }

  it('renders the bill search box instead of a redirect', () => {
    renderPicker();
    expect(screen.getByTestId('return-bill-search')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows matching paid/due bills but excludes drafts, and navigates with billId on pick', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByTestId('return-bill-search'), 'Ravi');

    expect(await screen.findByTestId('return-bill-result-bill-paid')).toBeInTheDocument();
    expect(screen.getByTestId('return-bill-result-bill-due')).toBeInTheDocument();
    expect(screen.queryByTestId('return-bill-result-bill-draft')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('return-bill-result-bill-due'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing/returns/new?billId=bill-due');
  });
});
