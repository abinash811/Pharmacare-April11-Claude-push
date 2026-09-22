/**
 * ThermalBillView — narrow receipt layout for BillDetail's on-screen
 * Print/Download when Settings > Receipt & Print > Paper Size is 80mm/58mm.
 *
 * Mirrors BillingWorkspace/components/PrintReceipt.jsx's ThermalReceipt
 * (same field set, no signature line) so a reprint looks the same as the
 * original Save & Print, not a differently-formatted document — the
 * exact gap this component closes (Sep 22, 2026): BillDetail used to
 * always render the wide A4-style card regardless of this setting.
 *
 * The GST summary block (added Sep 22, 2026, same day) mirrors that same
 * component's compact Rate/Taxable/GST table — this view had none at
 * all until then, and index.jsx now also gates it (and the A4 view's own
 * table) by the "Print GST summary table" setting, which neither view
 * read before.
 */
import React from 'react';
import { formatCurrency } from '@/utils/currency';
import { formatDateShort, formatTime } from '@/utils/dates';

function paymentLine(bill: any) {
  if (bill.payment_method === 'multiple' && bill.payment_splits?.length) {
    return bill.payment_splits
      .map((s: any) => `${s.method?.toUpperCase()} ${formatCurrency(Number(s.amount))}`)
      .join(' + ');
  }
  return bill.payment_method?.toUpperCase() || 'CASH';
}

interface Props {
  bill: any;
  pharmacy: any;
  printSettings: any;
  isParked: boolean;
  gstRows: any[];
  showGstin: boolean;
  showDrugLic: boolean;
  showFssai: boolean;
  showPan: boolean;
  showPatientName: boolean;
}

export default function ThermalBillView({
  bill, pharmacy, printSettings, isParked, gstRows,
  showGstin, showDrugLic, showFssai, showPan, showPatientName,
}: Props) {
  const width = printSettings?.paper_size === '58mm' ? '58mm' : '80mm';
  const address = [pharmacy?.city, pharmacy?.state, pharmacy?.pincode].filter(Boolean).join(', ');

  return (
    <div
      className="max-w-xs mx-auto bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none"
      data-testid="bill-view-thermal"
    >
      <div style={{ width: '100%', maxWidth: width, margin: '0 auto', padding: '16px', fontFamily: 'monospace', fontSize: '11px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{pharmacy?.pharmacy_name || 'PharmaCare'}</div>
          {printSettings?.bill_header && <div className="text-gray-600" style={{ fontSize: '9px', marginTop: '2px' }}>{printSettings.bill_header}</div>}
          {pharmacy?.address && <div style={{ fontSize: '9px', marginTop: '2px' }}>{pharmacy.address}{address ? `, ${address}` : ''}</div>}
          {pharmacy?.phone && <div style={{ fontSize: '9px' }}>Tel: {pharmacy.phone}</div>}
          {showGstin && pharmacy?.gstin && <div style={{ fontSize: '9px' }}>GSTIN: {pharmacy.gstin}</div>}
          {showDrugLic && pharmacy?.drug_license_number && <div style={{ fontSize: '9px' }}>DL: {pharmacy.drug_license_number}</div>}
          {showFssai && pharmacy?.fssai_number && <div style={{ fontSize: '9px' }}>FSSAI: {pharmacy.fssai_number}</div>}
          {showPan && pharmacy?.pan_number && <div style={{ fontSize: '9px' }}>PAN: {pharmacy.pan_number}</div>}
        </div>

        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0' }}>
          <div><strong>Bill No:</strong> {bill.bill_number}</div>
          <div><strong>Date:</strong> {formatDateShort(bill.created_at)} {formatTime(bill.created_at)}</div>
          {showPatientName ? (
            <>
              <div><strong>Patient:</strong> {bill.customer_name || 'Walk-in'}</div>
              {bill.customer_mobile && <div><strong>Phone:</strong> {bill.customer_mobile}</div>}
            </>
          ) : (
            <div className="text-gray-400" style={{ fontStyle: 'italic' }}>Patient name hidden</div>
          )}
          {bill.doctor_name && <div><strong>Doctor:</strong> Dr. {bill.doctor_name}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left',   padding: '2px 0', fontSize: '10px' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px' }}>Qty</th>
              <th style={{ textAlign: 'right',  padding: '2px 0', fontSize: '10px' }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {(bill.items || []).map((item: any, idx: number) => (
              <tr key={item.id || idx}>
                <td style={{ padding: '2px 0', fontSize: '10px' }}>{item.product_name || item.medicine_name}</td>
                <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right',  padding: '2px 0' }}>{formatCurrency(item.line_total || item.total || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {gstRows.length > 0 && (
          <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>GST Summary</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                </tr>
              </thead>
              <tbody>
                {gstRows.map(([rate, v]: [string, any]) => (
                  <tr key={rate}>
                    <td>{rate}%</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(v.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span><span>{formatCurrency(bill.subtotal || 0)}</span>
          </div>
          {(bill.discount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount:</span><span>-{formatCurrency(bill.discount)}</span>
            </div>
          )}
          {(bill.tax_amount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GST:</span><span>{formatCurrency(bill.tax_amount)}</span>
            </div>
          )}
          {Math.abs(bill.round_off || 0) >= 0.005 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Round off:</span><span>{formatCurrency(bill.round_off)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px' }}>
            <span>TOTAL:</span><span>{formatCurrency(bill.total_amount || 0)}</span>
          </div>
          {!isParked && (bill.due_amount || 0) > 0 && (
            <div className="text-red-600" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Balance Due:</span><span>{formatCurrency(bill.due_amount)}</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '9px' }}>
          {!isParked && <div>Payment: {paymentLine(bill)}</div>}
          <div style={{ marginTop: '4px' }}>{printSettings?.bill_footer || 'Thank you for your purchase!'}</div>
        </div>
      </div>
    </div>
  );
}
