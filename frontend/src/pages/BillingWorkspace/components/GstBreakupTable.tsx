/**
 * GstBreakupTable — GST-rate-wise summary for the printed receipt.
 * Gated by Settings > Tax & GST > "Print GST summary on bill" — the same
 * toggle the backend PDF already honors (utils/bill_pdf_a4.py's
 * show_gst_summary). Two variants: a compact 3-column strip for thermal
 * receipts (no room for a full CGST/SGST breakdown at 58/80mm), and the
 * full Rate/Taxable/CGST/SGST/Total table for A4/A5, matching
 * BillDetail's BillTotals.jsx "GST Breakup" table.
 */
import React from 'react';
import { formatCurrency } from '@/utils/currency';

interface GstRow {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
}

interface Props {
  rows: GstRow[];
  thermal?: boolean;
}

export default function GstBreakupTable({ rows, thermal }: Props) {
  if (!rows || rows.length === 0) return null;

  if (thermal) {
    return (
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
            {rows.map((row) => (
              <tr key={row.rate}>
                <td>{row.rate}%</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(row.taxable)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>GST Breakup</div>
      <table style={{ borderCollapse: 'collapse', fontSize: '9px', minWidth: '260px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left',  padding: '2px 6px' }}>Rate</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Taxable</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>CGST</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>SGST</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rate} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '2px 6px' }}>{row.rate}%</td>
              <td style={{ textAlign: 'right', padding: '2px 6px' }}>{formatCurrency(row.taxable)}</td>
              <td style={{ textAlign: 'right', padding: '2px 6px' }}>{formatCurrency(row.cgst)}</td>
              <td style={{ textAlign: 'right', padding: '2px 6px' }}>{formatCurrency(row.sgst)}</td>
              <td style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 'bold' }}>{formatCurrency(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
