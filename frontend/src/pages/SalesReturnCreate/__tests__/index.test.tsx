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

// Regression tests for the Sep 15, 2026 manual-returns build: a return
// with no original bill — allow_manual_returns and require_original_bill
// already existed as a permission/setting, but the backend always 400'd
// and the frontend had no way to add items at all without a billId.
describe('SalesReturnCreate — manual return (no billId)', () => {
  beforeEach(() => jest.clearAllMocks());

  function renderManual() {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('search-with-batches')) {
        return Promise.resolve({
          data: [{ sku: 'MANUAL-1', name: 'Cough Syrup 100ml' }],
        });
      }
      if (url.includes('stock/batches')) {
        return Promise.resolve({
          data: [{ id: 'batch-9', batch_no: 'CS-B9', expiry_iso: '2029-01-01', mrp_per_unit: 85, gst_percent: 12, qty_on_hand: 0 }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    return render(
      <MemoryRouter initialEntries={['/billing/returns/new']}>
        <SalesReturnCreate />
      </MemoryRouter>,
    );
  }

  it('shows the manual empty-state message and the item search box, not the bill-based one', async () => {
    renderManual();
    expect(await screen.findByText('No items added yet. Search above to add a return item.')).toBeInTheDocument();
    expect(screen.getByTestId('manual-item-search')).toBeInTheDocument();
  });

  it('lets the patient name be typed in directly', async () => {
    renderManual();
    const nameInput = await screen.findByTestId('manual-patient-name');
    await userEvent.type(nameInput, 'Walk-in Customer Test');
    expect(nameInput).toHaveValue('Walk-in Customer Test');
  });

  it('adds an item — including one at zero current stock — via search then batch pick', async () => {
    renderManual();
    const search = await screen.findByTestId('manual-item-search');
    await userEvent.type(search, 'cough');

    const productRow = await screen.findByTestId('manual-item-product-MANUAL-1');
    await userEvent.click(productRow);

    const batchRow = await screen.findByTestId('manual-item-batch-CS-B9');
    await userEvent.click(batchRow);

    expect(await screen.findByText('Cough Syrup 100ml')).toBeInTheDocument();
    expect(screen.getByText('CS-B9')).toBeInTheDocument();
    expect(screen.queryByText('No items added yet. Search above to add a return item.')).not.toBeInTheDocument();
  });
});
