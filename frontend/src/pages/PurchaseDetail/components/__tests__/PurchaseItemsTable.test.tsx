import React from 'react';
import { render, screen } from '@testing-library/react';
import PurchaseItemsTable from '../PurchaseItemsTable';

// Regression tests for the Sep 25, 2026 short/excess supply feature —
// a confirmed purchase's short/excess delivery must be visible when
// looking back at that purchase, not just at entry time.

const BASE_ITEM = {
  product_name: 'Paracetamol', manufacturer: '', pack_size: '', salt: '',
  batch_no: 'B1', expiry_date: '2027-12-31',
  qty_units: 100, free_qty_units: 0, ptr_per_unit: 10, mrp_per_unit: 20,
  gst_percent: 5, batch_priority: 'LIFA',
};

describe('PurchaseDetail PurchaseItemsTable — short/excess supply display', () => {
  it('shows no variance line when received_qty_units is absent (legacy purchases)', () => {
    render(<PurchaseItemsTable items={[BASE_ITEM]} withGst />);
    expect(screen.queryByText(/Short by|Excess by/)).not.toBeInTheDocument();
  });

  it('shows no variance line when received equals ordered', () => {
    render(<PurchaseItemsTable items={[{ ...BASE_ITEM, received_qty_units: 100 }]} withGst />);
    expect(screen.queryByText(/Short by|Excess by/)).not.toBeInTheDocument();
  });

  it('shows "Short by N" for a short delivery', () => {
    render(<PurchaseItemsTable items={[{ ...BASE_ITEM, received_qty_units: 95 }]} withGst />);
    expect(screen.getByText('Short by 5')).toBeInTheDocument();
  });

  it('shows "Excess by N" for an excess delivery', () => {
    render(<PurchaseItemsTable items={[{ ...BASE_ITEM, received_qty_units: 105 }]} withGst />);
    expect(screen.getByText('Excess by 5')).toBeInTheDocument();
  });
});
