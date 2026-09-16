import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { useBillActions } from '../useBillActions';
import api from '@/lib/axios';

// Regression tests for the Sep 16, 2026 Billing "Multi" payment rebuild.
// Covers the payload useBillActions builds for a split payment
// (payment_method="multiple", real payments array) and the split-sum guard.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

const BASE_SNAPSHOT = {
  billItems: [{ product_sku: 'X', product_name: 'X', batch_no: 'B1', qty: 1, unit_price: 500, gst_percent: 0 }],
  customerName: 'Walk-in Customer', customerPhone: '', customerId: null,
  doctorName: '', paymentType: 'multiple', paidNow: '',
  paymentSplits: [{ method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }],
  billDiscount: 0, billDiscountType: '%',
  mrpTotal: 500, totalDiscount: 0, totalGst: 0, totalCess: 0,
  grandTotal: 500, subtotal: 500, margin: { amount: 0, percent: 0 },
  draftNumber: null, editingDraftId: null, patientAddress: '', patientAge: '',
};

describe('useBillActions — Multi payment payload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.post as jest.Mock).mockResolvedValue({ data: { bill_number: 'INV-000001' } });
  });

  it('sends payment_method="multiple" and the real per-method payments array', async () => {
    const { result } = renderHook(
      () => useBillActions(BASE_SNAPSHOT, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).toHaveBeenCalledWith('bills', expect.objectContaining({
      status: 'paid',
      payment_method: 'multiple',
      payments: [{ method: 'cash', amount: 300 }, { method: 'upi', amount: 200 }],
    }));
  });

  it('blocks saving when the splits do not add up to the bill total', async () => {
    const snapshot = {
      ...BASE_SNAPSHOT,
      paymentSplits: [{ method: 'cash', amount: '100' }, { method: 'upi', amount: '100' }],
    };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('add up to the bill total'));
  });

  it('blocks saving when fewer than 2 split rows are filled in', async () => {
    const snapshot = { ...BASE_SNAPSHOT, paymentSplits: [{ method: 'cash', amount: '500' }] };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('at least 2 split payment rows'));
  });

  it('blocks saving when a split row is missing its method', async () => {
    const snapshot = {
      ...BASE_SNAPSHOT,
      paymentSplits: [{ method: '', amount: '300' }, { method: 'upi', amount: '200' }],
    };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBill(); });

    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not gate parking a bill on incomplete Multi splits, and falls back to plain cash', async () => {
    const snapshot = { ...BASE_SNAPSHOT, paymentSplits: [{ method: '', amount: '' }, { method: '', amount: '' }] };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.parkBill(); });

    expect(api.post).toHaveBeenCalledWith('bills', expect.objectContaining({
      status: 'draft', payment_method: 'cash', payments: undefined,
    }));
  });
});
