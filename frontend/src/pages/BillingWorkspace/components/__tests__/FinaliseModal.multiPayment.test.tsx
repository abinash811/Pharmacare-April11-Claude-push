import React from 'react';
import { render, screen } from '@testing-library/react';
import FinaliseModal from '../FinaliseModal';

// Regression test for the Sep 16, 2026 Billing "Multi" payment rebuild —
// the Finalise confirmation modal must show the real per-method split,
// not just the bare "Multiple" label, before the cashier commits the bill.

const BASE_PROPS = {
  open: true, onClose: jest.fn(), customerName: 'Walk-in Customer',
  mrpTotal: 500, totalDiscount: 0, billDiscount: 0, billDiscountType: '%' as const,
  totalGst: 0, totalCess: 0, grandTotal: 500,
  margin: { amount: 100, percent: 20 }, isSaving: false, onConfirm: jest.fn(),
};

describe('FinaliseModal — Multi payment summary', () => {
  it('shows the real per-method split for a Multi payment', () => {
    render(
      <FinaliseModal
        {...BASE_PROPS}
        paymentType="multiple"
        paymentSplits={[{ method: 'cash', amount: '300' }, { method: 'upi', amount: '200' }]}
      />,
    );

    expect(screen.getByText('Multi')).toBeInTheDocument();
    const summary = screen.getByTestId('multi-split-summary');
    expect(summary).toHaveTextContent('cash');
    expect(summary).toHaveTextContent('₹300.00');
    expect(summary).toHaveTextContent('upi');
    expect(summary).toHaveTextContent('₹200.00');
  });

  it('does not show the split summary for a plain cash bill', () => {
    render(<FinaliseModal {...BASE_PROPS} paymentType="cash" paymentSplits={[]} />);

    expect(screen.queryByTestId('multi-split-summary')).not.toBeInTheDocument();
    expect(screen.getByText('cash')).toBeInTheDocument();
  });
});
