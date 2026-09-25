import {
  isPackMode, toRealQty, toRealCostPerUnit, toRealMrpPerUnit, toRealReceivedQty,
  convertQtyMode, defaultQtyModeFor,
} from '../packUnitConversion';
import { PURCHASE_QTY_MODE } from '@/constants/domainConstants';

// Regression tests for the Sep 24, 2026 Purchase entry Pack/Unit feature —
// a pharmacist buying "10 strips of 10 tablets at ₹30/strip" should never
// have to compute ₹3/tablet by hand. See docs/07_BUSINESS_LOGIC.md.

describe('packUnitConversion', () => {
  const packItem = {
    qty_mode: PURCHASE_QTY_MODE.PACK, units_per_pack: 10,
    qty_units: 10, ptr_per_unit: 30, mrp_per_unit: 50,
  };
  const unitItem = {
    qty_mode: PURCHASE_QTY_MODE.UNIT, units_per_pack: 10,
    qty_units: 100, ptr_per_unit: 3, mrp_per_unit: 5,
  };

  it('converts a Pack-mode line to real per-unit qty/cost/MRP', () => {
    expect(toRealQty(packItem)).toBe(100);
    expect(toRealCostPerUnit(packItem)).toBe(3);
    expect(toRealMrpPerUnit(packItem)).toBe(5);
  });

  it('leaves a Unit-mode line unchanged — it is already real', () => {
    expect(toRealQty(unitItem)).toBe(100);
    expect(toRealCostPerUnit(unitItem)).toBe(3);
    expect(toRealMrpPerUnit(unitItem)).toBe(5);
  });

  it('isPackMode reflects qty_mode', () => {
    expect(isPackMode(packItem)).toBe(true);
    expect(isPackMode(unitItem)).toBe(false);
  });

  it('switching Pack -> Unit re-expresses the same real numbers, not a different total', () => {
    const converted = convertQtyMode(packItem, PURCHASE_QTY_MODE.UNIT);
    expect(converted.qty_mode).toBe(PURCHASE_QTY_MODE.UNIT);
    expect(converted.qty_units).toBe(100);
    expect(converted.ptr_per_unit).toBe(3);
    expect(converted.mrp_per_unit).toBe(5);
    // The real total this line represents must not change from the toggle alone.
    expect(toRealQty(converted) * toRealCostPerUnit(converted)).toBe(toRealQty(packItem) * toRealCostPerUnit(packItem));
  });

  it('switching Unit -> Pack re-expresses the same real numbers', () => {
    const converted = convertQtyMode(unitItem, PURCHASE_QTY_MODE.PACK);
    expect(converted.qty_mode).toBe(PURCHASE_QTY_MODE.PACK);
    expect(converted.qty_units).toBe(10);
    expect(converted.ptr_per_unit).toBe(30);
    expect(converted.mrp_per_unit).toBe(50);
  });

  it('switching to the same mode is a no-op', () => {
    expect(convertQtyMode(packItem, PURCHASE_QTY_MODE.PACK)).toBe(packItem);
  });

  it('a product with units_per_pack=1 defaults to Unit mode (nothing to pack)', () => {
    expect(defaultQtyModeFor({ units_per_pack: 1 })).toBe(PURCHASE_QTY_MODE.UNIT);
    expect(defaultQtyModeFor({})).toBe(PURCHASE_QTY_MODE.UNIT);
  });

  it('a product with units_per_pack>1 defaults to Pack mode', () => {
    expect(defaultQtyModeFor({ units_per_pack: 10 })).toBe(PURCHASE_QTY_MODE.PACK);
  });

  it('a line with no units_per_pack at all behaves as a real (unit) value — backward compatible with existing rows', () => {
    const legacyItem = { qty_units: 30, ptr_per_unit: 3, mrp_per_unit: 5 };
    expect(toRealQty(legacyItem)).toBe(30);
    expect(toRealCostPerUnit(legacyItem)).toBe(3);
    expect(toRealMrpPerUnit(legacyItem)).toBe(5);
  });

  // Sep 25, 2026 — short/excess supply
  describe('toRealReceivedQty', () => {
    it('returns null when no discrepancy was recorded (the common case)', () => {
      expect(toRealReceivedQty({ ...unitItem, received_qty_units: null })).toBeNull();
      expect(toRealReceivedQty({ ...unitItem, received_qty_units: '' })).toBeNull();
      expect(toRealReceivedQty({ ...unitItem })).toBeNull();
    });

    it('converts a Pack-mode received qty to real units', () => {
      expect(toRealReceivedQty({ ...packItem, received_qty_units: 9 })).toBe(90);
    });

    it('passes a Unit-mode received qty through unchanged', () => {
      expect(toRealReceivedQty({ ...unitItem, received_qty_units: 95 })).toBe(95);
    });

    it('is carried through a Pack <-> Unit mode switch, converted consistently', () => {
      const shortPack = { ...packItem, received_qty_units: 9 }; // 9 strips instead of 10
      const converted = convertQtyMode(shortPack, PURCHASE_QTY_MODE.UNIT);
      expect(toRealReceivedQty(converted)).toBe(90);
    });
  });
});
