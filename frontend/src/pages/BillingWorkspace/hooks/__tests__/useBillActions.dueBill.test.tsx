import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { useBillActions } from '../useBillActions';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 "Due" payment reversal — reversing
// the Sep 14, 2026 block on due/partial-payment bills. Covers the payload
// useBillActions builds for a due bill (customer_id, payment_method,
// payments) and the paid-now-can't-exceed-total guard.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

const BASE_SNAPSHOT = {
  billItems: [{ product_sku: 'X', product_name: 'X', batch_no: 'B1', qty: 1, unit_price: 500, gst_percent: 0 }],
  customerName: 'Suresh Kumar', customerPhone: '9876543210', customerId: 'cust-1',
  doctorName: '', paymentType: 'due', paidNow: '100',
  billDiscount: 0, billDiscountType: '%',
  mrpTotal: 500, totalDiscount: 0, totalGst: 0, totalCess: 0,
  grandTotal: 500, subtotal: 500, margin: { amount: 0, percent: 0 },
  draftNumber: null, editingDraftId: null, patientAddress: '', patientAge: '',
};

describe('useBillActions — Due payment payload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.post as jest.Mock).mockResolvedValue({ data: { bill_number: 'INV-000001' } });
  });

  it('sends customer_id, payment_method="cash", and the paid-now payments array for a due bill', async () => {
    const { result } = renderHook(
      () => useBillActions(BASE_SNAPSHOT, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).toHaveBeenCalledWith('bills', expect.objectContaining({
      customer_id: 'cust-1',
      status: 'due',
      payment_method: 'cash',
      payments: [{ amount: 100 }],
    }));
  });

  it('sends payment_method="due" and no payments array when nothing is paid now', async () => {
    const snapshot = { ...BASE_SNAPSHOT, paidNow: '' };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).toHaveBeenCalledWith('bills', expect.objectContaining({
      status: 'due', payment_method: 'due', payments: undefined,
    }));
  });

  it('blocks saving and never calls the API when paid-now exceeds the bill total', async () => {
    const snapshot = { ...BASE_SNAPSHOT, paidNow: '600' };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('more than the bill total'));
  });

  it('sends status="paid" and no payments array for a normal cash bill', async () => {
    const snapshot = { ...BASE_SNAPSHOT, paymentType: 'cash', paidNow: '' };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).toHaveBeenCalledWith('bills', expect.objectContaining({
      status: 'paid', payment_method: 'cash', payments: undefined,
    }));
  });
});
