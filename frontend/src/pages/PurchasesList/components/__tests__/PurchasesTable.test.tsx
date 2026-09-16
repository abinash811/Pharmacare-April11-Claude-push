import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PurchasesTable from '../PurchasesTable';

// Regression tests for the Sep 15, 2026 Purchase Returns product-review:
// Purchase List had no way to start a return at all — the tab bar only
// switched to the Returns tab, with no per-row action. A confirmed
// purchase already has a real purchase_id to return against (same shape
// as Purchase Detail's own working "Purchase Return" MoreMenu item), so
// this is a per-row icon button, not a new page.

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const pagination = { page: 1, pageSize: 20 };
const getPaymentBadge = () => ({ status: 'due', label: 'Due', clickable: true });

function renderTable(purchases: any[]) {
  return render(
    <MemoryRouter>
      <PurchasesTable
        purchases={purchases}
        loading={false}
        pagination={pagination}
        isFiltered={false}
        onPayClick={jest.fn()}
        getPaymentBadge={getPaymentBadge}
        onDeleteClick={jest.fn()}
      />
    </MemoryRouter>,
  );
}

describe('PurchasesTable — return entry point', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a Return action for a confirmed purchase and navigates with its purchase_id', async () => {
    renderTable([{ id: 'pur-1', status: 'confirmed', purchase_number: 'PUR-2026-0001', total_value: 500, amount_paid: 0 }]);
    const returnBtn = screen.getByTestId('return-pur-1');
    await userEvent.click(returnBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/purchases/returns/create?purchase_id=pur-1');
  });

  it('does not show a Return action for a draft purchase', () => {
    renderTable([{ id: 'pur-2', status: 'draft', purchase_number: 'PUR-2026-0002', total_value: 500, amount_paid: 0 }]);
    expect(screen.queryByTestId('return-pur-2')).not.toBeInTheDocument();
  });
});
