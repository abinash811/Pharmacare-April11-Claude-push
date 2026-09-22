import { computeGstBreakup } from '../computeGstBreakup';

describe('computeGstBreakup', () => {
  it('groups items by gst_percent and splits GST evenly into CGST/SGST', () => {
    // ₹105 net (5% GST) -> taxable 100, gst 5, cgst 2.5, sgst 2.5
    const rows = computeGstBreakup([
      { gst_percent: 5, net_amount: 105 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].rate).toBe(5);
    expect(rows[0].taxable).toBeCloseTo(100, 2);
    expect(rows[0].cgst).toBeCloseTo(2.5, 2);
    expect(rows[0].sgst).toBeCloseTo(2.5, 2);
    expect(rows[0].total).toBeCloseTo(5, 2);
  });

  it('sums multiple items sharing the same rate into one row', () => {
    const rows = computeGstBreakup([
      { gst_percent: 12, net_amount: 112 },
      { gst_percent: 12, net_amount: 56 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].taxable).toBeCloseTo(150, 2);
  });

  it('keeps different rates as separate rows, sorted ascending', () => {
    const rows = computeGstBreakup([
      { gst_percent: 18, net_amount: 118 },
      { gst_percent: 5, net_amount: 105 },
    ]);
    expect(rows.map((r) => r.rate)).toEqual([5, 18]);
  });

  it('drops a zero-GST item (0% rate contributes no real GST row)', () => {
    const rows = computeGstBreakup([{ gst_percent: 0, net_amount: 100 }]);
    expect(rows).toHaveLength(0);
  });

  it('returns an empty array for no items', () => {
    expect(computeGstBreakup([])).toEqual([]);
    expect(computeGstBreakup(undefined)).toEqual([]);
  });
});
