/**
 * PrintReceipt
 *
 * Hidden 80mm thermal-printer receipt. Becomes visible only when the
 * browser's @media print fires. The parent triggers window.print() after
 * populating billData.
 *
 * Props:
 *   billData  {object|null}  — populated by parent before window.print()
 *     .bill_number    {string}
 *     .customer_name  {string}
 *     .customer_phone {string}
 *     .doctor_name    {string}
 *     .payment_method {string}
 *     .items          {Array<{ product_name, qty, net_amount }>}
 *     .subtotal       {number}
 *     .total_discount {number}
 *     .total_gst      {number}
 *     .grand_total    {number}
 */

import React from 'react';
import { formatCurrency }  from '@/utils/currency';
import { formatDateTime }  from '@/utils/dates';

export default function PrintReceipt({ billData }) {
  if (!billData) return null;

  const {
    bill_number,
    customer_name,
    customer_phone,
    doctor_name,
    payment_method,
    items = [],
    subtotal       = 0,
    total_discount = 0,
    total_gst      = 0,
    grand_total    = 0,
  } = billData;

  return (
    <>
      {/* ── Hidden at screen size; shown only during print ── */}
      <div className="print-receipt hidden print:block">
        <div style={{ width: '80mm', padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>PharmaCare</h2>
            <p style={{ margin: '2px 0', fontSize: '10px' }}>Pharmacy Management System</p>
            <p style={{ margin: '2px 0', fontSize: '10px' }}>Tel: 1800-XXX-XXXX</p>
          </div>

          {/* Bill meta */}
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0', margin: '5px 0' }}>
            <p style={{ margin: '2px 0' }}><strong>Invoice:</strong> {bill_number}</p>
            <p style={{ margin: '2px 0' }}><strong>Date:</strong> {formatDateTime(new Date())}</p>
            <p style={{ margin: '2px 0' }}><strong>Customer:</strong> {customer_name}</p>
            {customer_phone && (
              <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {customer_phone}</p>
            )}
            {doctor_name && (
              <p style={{ margin: '2px 0' }}><strong>Doctor:</strong> {doctor_name}</p>
            )}
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left',   padding: '3px 0' }}>Item</th>
                <th style={{ textAlign: 'center', padding: '3px 0' }}>Qty</th>
                <th style={{ textAlign: 'right',  padding: '3px 0' }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '3px 0', fontSize: '10px' }}>{item.product_name}</td>
                  <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right',  padding: '3px 0' }}>
                    {formatCurrency(item.net_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {total_discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-{formatCurrency(total_discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GST:</span>
              <span>{formatCurrency(total_gst)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '5px', borderTop: '1px solid #000', paddingTop: '5px' }}>
              <span>TOTAL:</span>
              <span>{formatCurrency(grand_total)}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '10px' }}>
            <p style={{ margin: '2px 0' }}>Payment: {payment_method?.toUpperCase()}</p>
            <p style={{ margin: '5px 0' }}>Thank you for your purchase!</p>
            <p style={{ margin: '2px 0' }}>Get well soon!</p>
          </div>
        </div>
      </div>

      {/* ── @media print rules ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-receipt,
          .print-receipt * { visibility: visible !important; display: block !important; }
          .print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
          }
        }
      `}</style>
    </>
  );
}
