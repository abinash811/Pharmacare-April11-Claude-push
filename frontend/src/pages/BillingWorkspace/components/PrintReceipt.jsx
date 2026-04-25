/**
 * PrintReceipt
 *
 * Hidden component — visible only during @media print.
 * Renders in the format specified by `format` prop.
 *
 * Thermal (80mm / 58mm) — strip receipt for POS printers
 * A4 / A5              — full invoice for office printers
 *
 * Props:
 *   billData  {object|null}
 *   format    {'80mm'|'58mm'|'a4'|'a5'}  default: '80mm'
 */
import React from 'react';
import { formatCurrency } from '@/utils/currency';
import { formatDateTime } from '@/utils/dates';

const isThermal = (format) => format === '80mm' || format === '58mm';

// ── Thermal receipt (80mm / 58mm) ────────────────────────────────────────────
function ThermalReceipt({ billData, format }) {
  const width = format === '58mm' ? '58mm' : '80mm';
  const {
    bill_number, customer_name, customer_phone, doctor_name,
    payment_method, pharmacy_name, pharmacy_address, pharmacy_phone,
    gstin, drug_license, items = [],
    subtotal = 0, total_discount = 0, total_gst = 0, grand_total = 0,
    bill_footer,
  } = billData;

  return (
    <div style={{ width, padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
      {/* Pharmacy header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{pharmacy_name || 'PharmaCare'}</div>
        {pharmacy_address && <div style={{ fontSize: '9px', marginTop: '2px' }}>{pharmacy_address}</div>}
        {pharmacy_phone && <div style={{ fontSize: '9px' }}>Tel: {pharmacy_phone}</div>}
        {gstin && <div style={{ fontSize: '9px' }}>GSTIN: {gstin}</div>}
        {drug_license && <div style={{ fontSize: '9px' }}>DL: {drug_license}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0' }}>
        <div><strong>Invoice:</strong> {bill_number}</div>
        <div><strong>Date:</strong> {formatDateTime(new Date())}</div>
        <div><strong>Patient:</strong> {customer_name || 'Walk-in'}</div>
        {customer_phone && <div><strong>Phone:</strong> {customer_phone}</div>}
        {doctor_name && <div><strong>Doctor:</strong> {doctor_name}</div>}
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
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: '2px 0', fontSize: '10px' }}>{item.product_name}</td>
              <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.qty}</td>
              <td style={{ textAlign: 'right',  padding: '2px 0' }}>{formatCurrency(item.net_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span><span>{formatCurrency(subtotal)}</span>
        </div>
        {total_discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount:</span><span>-{formatCurrency(total_discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>GST:</span><span>{formatCurrency(total_gst)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px' }}>
          <span>TOTAL:</span><span>{formatCurrency(grand_total)}</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '9px' }}>
        <div>Payment: {payment_method?.toUpperCase()}</div>
        <div style={{ marginTop: '4px' }}>{bill_footer || 'Thank you for your purchase!'}</div>
      </div>
    </div>
  );
}

// ── A4 / A5 invoice ───────────────────────────────────────────────────────────
function A4Invoice({ billData, format }) {
  const {
    bill_number, customer_name, customer_phone, doctor_name,
    payment_method, pharmacy_name, pharmacy_address, pharmacy_phone,
    gstin, drug_license, fssai,
    items = [],
    subtotal = 0, total_discount = 0, total_gst = 0, grand_total = 0,
    bill_header, bill_footer, print_signature,
  } = billData;

  const isA5 = format === 'a5';

  return (
    <div style={{ width: isA5 ? '148mm' : '210mm', padding: '16mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#111' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: '10px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{pharmacy_name || 'PharmaCare'}</div>
          {bill_header && <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{bill_header}</div>}
          {pharmacy_address && <div style={{ fontSize: '10px', marginTop: '4px' }}>{pharmacy_address}</div>}
          {pharmacy_phone && <div style={{ fontSize: '10px' }}>Tel: {pharmacy_phone}</div>}
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px' }}>
          {gstin && <div><strong>GSTIN:</strong> {gstin}</div>}
          {drug_license && <div><strong>DL No:</strong> {drug_license}</div>}
          {fssai && <div><strong>FSSAI:</strong> {fssai}</div>}
        </div>
      </div>

      {/* Invoice title + meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Tax Invoice</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>Invoice No: <strong>{bill_number}</strong></div>
          <div style={{ fontSize: '10px', color: '#555' }}>Date: <strong>{formatDateTime(new Date())}</strong></div>
          <div style={{ fontSize: '10px', color: '#555' }}>Payment: <strong style={{ textTransform: 'capitalize' }}>{payment_method}</strong></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Patient Details</div>
          <div>{customer_name || 'Walk-in Customer'}</div>
          {customer_phone && <div>{customer_phone}</div>}
          {doctor_name && <div>Dr. {doctor_name}</div>}
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'left'   }}>#</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'left'   }}>Medicine</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'center' }}>Batch</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'center' }}>Expiry</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'center' }}>Qty</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right'  }}>MRP</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right'  }}>Disc%</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right'  }}>GST%</th>
            <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right'  }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px' }}>{item.product_name}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'center' }}>{item.batch_no || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'center' }}>{item.expiry_date || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'center' }}>{item.qty}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'right'  }}>{formatCurrency(item.unit_price || item.mrp || 0)}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'right'  }}>{item.discount_percent || 0}%</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'right'  }}>{item.gst_percent || 0}%</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.net_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <table style={{ fontSize: '10px', minWidth: '200px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 8px', color: '#555' }}>Subtotal</td>
              <td style={{ padding: '2px 8px', textAlign: 'right' }}>{formatCurrency(subtotal)}</td>
            </tr>
            {total_discount > 0 && (
              <tr>
                <td style={{ padding: '2px 8px', color: '#555' }}>Discount</td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: '#c00' }}>-{formatCurrency(total_discount)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '2px 8px', color: '#555' }}>GST</td>
              <td style={{ padding: '2px 8px', textAlign: 'right' }}>{formatCurrency(total_gst)}</td>
            </tr>
            <tr style={{ borderTop: '2px solid #111', fontWeight: 'bold', fontSize: '12px' }}>
              <td style={{ padding: '4px 8px' }}>Total</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signature */}
      {print_signature && (
        <div style={{ textAlign: 'right', marginTop: '24px', fontSize: '10px' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '4px', width: '120px', marginLeft: 'auto' }}>
            Authorised Signatory
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ccc', marginTop: '12px', paddingTop: '6px', fontSize: '9px', color: '#777', textAlign: 'center' }}>
        {bill_footer || 'Thank you for your purchase!'}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PrintReceipt({ billData, format = '80mm' }) {
  if (!billData) return null;

  const thermal = isThermal(format);
  const printWidth = thermal ? (format === '58mm' ? '58mm' : '80mm') : (format === 'a5' ? '148mm' : '210mm');

  return (
    <>
      <div className="print-receipt hidden print:block">
        {thermal
          ? <ThermalReceipt billData={billData} format={format} />
          : <A4Invoice      billData={billData} format={format} />
        }
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-receipt,
          .print-receipt * { visibility: visible !important; }
          .print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: ${printWidth};
          }
        }
      `}</style>
    </>
  );
}
