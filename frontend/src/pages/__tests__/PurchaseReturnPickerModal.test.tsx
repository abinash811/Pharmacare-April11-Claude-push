import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PurchaseReturnPickerModal from '../PurchaseReturnPickerModal';
import api from '@/lib/axios';

// Regression tests for the Sep 15, 2026 Purchase Returns product-review:
// the Returns list's header "Purchase Return" button just showed a toast
// telling the pharmacist to go find a purchase manually, and the
// empty-state button navigated straight to the create page with no
// purchase_id at all (which immediately bounces back to /purchases). This
// modal is the real fix — search confirmed purchases, pick one, land on
// the create page with a real purchase_id.

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const PURCHASES = [
  { id: 'pur-1', purchase_number: 'PUR-2026-0001', supplier_name: 'Test Distributors', purchase_date: '2026-09-15', total_value: 2800 },
];

describe('PurchaseReturnPickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { data: PURCHASES } });
  });

  it('lists confirmed purchases and navigates to the create page on pick', async () => {
    render(
      <MemoryRouter>
        <PurchaseReturnPickerModal onClose={jest.fn()} />
      </MemoryRouter>,
    );
    const row = await screen.findByTestId('purchase-picker-row-pur-1');
    expect(row).toHaveTextContent('PUR-2026-0001');
    expect(row).toHaveTextContent('Test Distributors');

    await userEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/purchases/returns/create?purchase_id=pur-1');
  });

  it('only ever searches confirmed purchases', async () => {
    render(
      <MemoryRouter>
        <PurchaseReturnPickerModal onClose={jest.fn()} />
      </MemoryRouter>,
    );
    await screen.findByTestId('purchase-picker-row-pur-1');
    const url = (api.get as jest.Mock).mock.calls[0][0];
    expect(url).toContain('status=confirmed');
  });
});
