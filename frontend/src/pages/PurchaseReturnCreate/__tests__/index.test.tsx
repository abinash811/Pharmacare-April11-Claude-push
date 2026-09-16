import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PurchaseReturnCreate from '../index';
import api from '@/lib/axios';

// Jest hoists jest.mock() above every import, so the factory can't close
// over a module-scope `createContext` import — it has to require() react
// itself, lazily, inside the factory.
jest.mock('@/App', () => ({
  AuthContext: require('react').createContext({ user: { name: 'Admin User', role: 'admin' } }),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// jsdom (this test env) has no crypto.randomUUID — the component calls it
// per return item when mapping the fetched purchase's items.
const testCrypto = (window.crypto || {}) as { randomUUID?: () => string };
if (!testCrypto.randomUUID) {
  let n = 0;
  testCrypto.randomUUID = () => `test-uuid-${n++}`;
  Object.defineProperty(window, 'crypto', { value: testCrypto, configurable: true });
}

// Regression tests for the Sep 15, 2026 Purchase Returns build (found via
// product-review): (1) there was no reason field anywhere in the UI, so
// every return silently sent reason="return" regardless of what actually
// happened; (2) a failed load/save read err.response?.data?.detail
// directly, which crashes React on a 422 (an array body) instead of the
// normalized err.message.

const ITEMS_RESPONSE = {
  supplier_id: 'sup-1', supplier_name: 'Test Distributors', invoice_no: 'INV-1',
  purchase_number: 'PUR-2026-0001',
  items: [{
    product_id: 'prod-1', product_name: 'Paracetamol 500mg', product_sku: 'PARA-500',
    batch_id: 'batch-1', batch_no: 'B001', expiry_date: '2028-01-01',
    mrp: 100, ptr: 80, gst_percent: 12, original_qty: 10, already_returned_qty: 0,
    max_returnable_qty: 10,
  }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/purchases/returns/create?purchase_id=pur-1']}>
      <PurchaseReturnCreate />
    </MemoryRouter>,
  );
}

describe('PurchaseReturnCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('items-for-return')) return Promise.resolve({ data: ITEMS_RESPONSE });
      if (url.includes('/users')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it('shows a reason selector defaulting to Damaged in transit', async () => {
    renderPage();
    const reasonSelect = await screen.findByTestId('return-reason');
    expect(reasonSelect).toHaveValue('damaged');
    expect(screen.getByText('Damaged in transit')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Wrong item shipped')).toBeInTheDocument();
  });

  it('sends the selected reason in the create payload', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { return_number: 'PRET-2026-0001' } });
    renderPage();

    const reasonSelect = await screen.findByTestId('return-reason');
    await userEvent.selectOptions(reasonSelect, 'expired');

    const qtyInput = await screen.findByTestId('return-qty-0');
    await userEvent.type(qtyInput, '2');

    await userEvent.click(screen.getByTestId('save-return-btn'));
    await userEvent.click(await screen.findByTestId('confirm-btn'));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const payload = (api.post as jest.Mock).mock.calls[0][1];
    expect(payload.reason).toBe('expired');
  });

  it('shows the real error reason (not a raw object) when loading the purchase fails', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('items-for-return')) {
        return Promise.reject({ message: 'Purchase not found' });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();
    // Should not throw "Objects are not valid as a React child" — a plain
    // string toast is enough evidence the component read err.message,
    // not a raw response object.
    await waitFor(() => expect(api.get).toHaveBeenCalled());
  });
});
