import React from 'react';
import { render, screen } from '@testing-library/react';
import PrintReceipt from '../PrintReceipt';

// Live-verified bug (Sep 14, 2026): Settings > Receipt & Print's "Bill
// Header" field saves correctly and shows in that page's own preview, but
// the REAL printed receipt for the default paper size (80mm thermal) never
// rendered it — ThermalReceipt destructured bill_footer but not
// bill_header, so a pharmacist's custom header text silently never
// reached the counter printer while the footer worked fine. Confirmed via
// a real headless-browser bill creation + print before fixing; this test
// locks the fix in place.
const baseBillData = {
  bill_number: 'INV-000123',
  pharmacy_name: 'Test Pharmacy',
  pharmacy_address: '1 Test Street',
  bill_header: 'Custom header text',
  bill_footer: 'Custom footer text',
  items: [{ product_name: 'Paracetamol', qty: 1, net_amount: 20 }],
  subtotal: 20, total_discount: 0, total_gst: 1, grand_total: 21,
  payment_method: 'cash',
};

describe('PrintReceipt — bill header/footer render for every paper format', () => {
  it.each(['80mm', '58mm'])('renders bill_header and bill_footer on the %s thermal receipt', (format) => {
    render(<PrintReceipt billData={baseBillData} format={format} />);
    expect(screen.getByText('Custom header text')).toBeInTheDocument();
    expect(screen.getByText('Custom footer text')).toBeInTheDocument();
  });

  it.each(['a4', 'a5'])('renders bill_header and bill_footer on the %s invoice', (format) => {
    render(<PrintReceipt billData={baseBillData} format={format} />);
    expect(screen.getByText('Custom header text')).toBeInTheDocument();
    expect(screen.getByText('Custom footer text')).toBeInTheDocument();
  });

  it('omits the header line entirely when no bill_header is set (no empty gap)', () => {
    render(<PrintReceipt billData={{ ...baseBillData, bill_header: undefined }} format="80mm" />);
    expect(screen.queryByText('Custom header text')).not.toBeInTheDocument();
  });
});
