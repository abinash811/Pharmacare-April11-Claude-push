import { buildPurchasePayload } from '../buildPurchasePayload';

// Regression test for the Sep 24, 2026 Purchase entry Pack/Unit feature —
// the backend contract (qty_units/cost_price_per_unit/mrp_per_unit) must
// always receive real per-unit values, never raw pack-mode input.

describe('buildPurchasePayload — Pack/Unit conversion', () => {
  const baseArgs = {
    status: 'draft',
    selectedSupplier: { id: 'sup-1' },
    billDate: new Date('2026-09-24'),
    dueDate: null,
    supplierInvoiceNo: '',
    invoiceAttachment: null,
    orderType: 'direct',
    withGST: true,
    purchaseOn: 'credit',
    internalNote: '',
    invoiceBreakdown: {},
    batchPriority: 'LIFA',
  };

  it('converts a Pack-mode line (10 strips at ₹30/strip) to real per-unit values', () => {
    const items = [{
      product_sku: 'SKU-1', product_name: 'Paracetamol', batch_no: 'B1', expiry_mmyy: '12/27',
      units_per_pack: 10, qty_mode: 'pack',
      qty_units: 10, free_qty_units: 0, ptr_per_unit: 30, mrp_per_unit: 50, gst_percent: 5,
    }];
    const payload = buildPurchasePayload({ ...baseArgs, items });
    expect(payload.items[0]).toMatchObject({
      qty_units: 100, cost_price_per_unit: 3, ptr_per_unit: 3, mrp_per_unit: 5,
    });
  });

  it('leaves a Unit-mode line unchanged — already real', () => {
    const items = [{
      product_sku: 'SKU-1', product_name: 'Paracetamol', batch_no: 'B1', expiry_mmyy: '12/27',
      units_per_pack: 10, qty_mode: 'unit',
      qty_units: 100, free_qty_units: 0, ptr_per_unit: 3, mrp_per_unit: 5, gst_percent: 5,
    }];
    const payload = buildPurchasePayload({ ...baseArgs, items });
    expect(payload.items[0]).toMatchObject({
      qty_units: 100, cost_price_per_unit: 3, ptr_per_unit: 3, mrp_per_unit: 5,
    });
  });

  it('a legacy line with no qty_mode/units_per_pack still sends its values unchanged', () => {
    const items = [{
      product_sku: 'SKU-1', product_name: 'Paracetamol', batch_no: 'B1', expiry_mmyy: '12/27',
      qty_units: 30, free_qty_units: 0, ptr_per_unit: 3, mrp_per_unit: 5, gst_percent: 5,
    }];
    const payload = buildPurchasePayload({ ...baseArgs, items });
    expect(payload.items[0]).toMatchObject({
      qty_units: 30, cost_price_per_unit: 3, ptr_per_unit: 3, mrp_per_unit: 5,
    });
  });
});
