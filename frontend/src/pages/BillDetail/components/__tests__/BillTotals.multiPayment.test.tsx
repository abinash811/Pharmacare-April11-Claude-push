import React from 'react';
import { render, screen } from '@testing-library/react';
import BillTotals from '../BillTotals';

// Regression test for the Sep 16, 2026 Billing "Multi" payment rebuild:
// BillDetail used to render the bare word "Paid (MULTIPLE)" for a
// split-paid bill, with zero trace of the real per-method breakdown —
// found while checking every display surface of Bill.payment_method for
// this feature (Manifesto rule 11), same bug class as PrintReceipt.jsx.

const BASE_BILL = {
  subtotal: 500, discount: 0, tax_amount: 0, round_off: 0,
  total_amount: 500, paid_amount: 500, due_amount: 0,
};

describe('BillTotals — Multi payment display', () => {
  it('renders the real per-method split instead of the bare word "MULTIPLE"', () => {
    render(
      <BillTotals
        bill={{
          ...BASE_BILL, payment_method: 'multiple',
          payment_splits: [{ method: 'cash', amount: 300 }, { method: 'upi', amount: 200 }],
        }}
        gstRows={[]}
        isParked={false}
      />,
    );

    expect(screen.getByText(/Paid \(CASH ₹300\.00 \+ UPI ₹200\.00\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Paid \(MULTIPLE\)/)).not.toBeInTheDocument();
  });

  it('still shows a plain method label for a normal single-method bill', () => {
    render(
      <BillTotals
        bill={{ ...BASE_BILL, payment_method: 'cash', payment_splits: [] }}
        gstRows={[]}
        isParked={false}
      />,
    );

    expect(screen.getByText(/Paid \(CASH\)/)).toBeInTheDocument();
  });
});
