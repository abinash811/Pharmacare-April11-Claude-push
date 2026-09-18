import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { useBillActions } from '../useBillActions';
import api from '@/lib/axios';

// Regression tests for the Sep 18, 2026 same-day bill-edit feature
// (docs/15_ROADMAP.md's Billing table). Found while wiring it: every save
// path here always POSTed a brand-new bill, even when editingDraftId was
// set — resuming and finalizing a parked draft silently orphaned the
// original DRAFT-xxxx row instead of updating it, and the new backend
// PUT /bills/{id} same-day-correction logic had no frontend caller at all.
// These tests lock in that editingDraftId now routes through PUT.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), put: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

const BASE_SNAPSHOT = {
  billItems: [{ product_sku: 'X', product_name: 'X', batch_no: 'B1', qty: 1, unit_price: 500, gst_percent: 0 }],
  customerName: 'Suresh Kumar', customerPhone: '9876543210', customerId: 'cust-1',
  doctorName: '', paymentType: 'cash', paidNow: '',
  billDiscount: 0, billDiscountType: '%',
  mrpTotal: 500, totalDiscount: 0, totalGst: 0, totalCess: 0,
  grandTotal: 500, subtotal: 500, margin: { amount: 0, percent: 0 },
  draftNumber: null, editingDraftId: null, patientAddress: '', patientAge: '',
};

describe('useBillActions — editing an existing bill routes through PUT', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.post as jest.Mock).mockResolvedValue({ data: { bill_number: 'INV-000001' } });
    (api.put as jest.Mock).mockResolvedValue({ data: { bill_number: 'INV-000001' } });
  });

  it('POSTs a brand-new bill when editingDraftId is null', async () => {
    const { result } = renderHook(
      () => useBillActions(BASE_SNAPSHOT, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.confirmAndSaveBill({ internalNote: '' }); });

    expect(api.post).toHaveBeenCalledWith('bills', expect.any(Object));
    expect(api.put).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('created'));
  });

  it('PUTs to the existing bill when editingDraftId is set (resumed draft or same-day correction)', async () => {
    const snapshot = { ...BASE_SNAPSHOT, editingDraftId: 'bill-42' };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.confirmAndSaveBill({ internalNote: '' }); });

    expect(api.put).toHaveBeenCalledWith('bills/bill-42', expect.any(Object));
    expect(api.post).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('updated'));
  });

  it('parkBill also PUTs when editingDraftId is set, instead of creating a second row', async () => {
    const snapshot = { ...BASE_SNAPSHOT, editingDraftId: 'bill-42' };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.parkBill(); });

    expect(api.put).toHaveBeenCalledWith('bills/bill-42', expect.objectContaining({ status: 'draft' }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('saveBillAndPrint PUTs when editingDraftId is set', async () => {
    const snapshot = { ...BASE_SNAPSHOT, editingDraftId: 'bill-42' };
    const { result } = renderHook(
      () => useBillActions(snapshot, jest.fn(), jest.fn(), {}, false), { wrapper },
    );
    await act(async () => { await result.current.saveBillAndPrint(); });

    expect(api.put).toHaveBeenCalledWith('bills/bill-42', expect.any(Object));
    expect(api.post).not.toHaveBeenCalled();
  });
});
