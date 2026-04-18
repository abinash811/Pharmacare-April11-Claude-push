/**
 * BillDetail — read-only view of a completed/parked bill.
 * Route: /billing/:id
 *
 * Shows:
 *  • Bill header (number, date, status)
 *  • Customer + doctor info
 *  • Line items table
 *  • GST summary
 *  • Payment details
 *  • Print & Edit actions
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Edit, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSkeleton, StatusBadge } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatDateShort, formatTime } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';

// ── Status helpers ─────────────────────────────────────────────────────────────
function BillStatusChip({ status, billNumber }) {
  const isParked = status === 'parked' || status === 'draft' || billNumber?.toLowerCase().includes('draft');
  if (isParked) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
      <Clock className="w-4 h-4" /> Parked
    </span>
  );
  if (status === 'due') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">
      <AlertCircle className="w-4 h-4" /> Due
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
      <CheckCircle className="w-4 h-4" /> Paid
    </span>
  );
}

export default function BillDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const printRef   = useRef(null);
  const [bill, setBill]       = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [billRes, settingsRes] = await Promise.all([
          api.get(apiUrl.bill(id)),
          api.get(apiUrl.settings()).catch(() => ({ data: { general: {} } })),
        ]);
        setBill(billRes.data);
        // settings endpoint returns { general: { pharmacy_name, address, ... } }
        setPharmacy(settingsRes.data?.general || {});
      } catch {
        toast.error('Failed to load bill');
        navigate('/billing');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]); // eslint-disable-line

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <PageSkeleton />;
  if (!bill)   return null;

  const isParked = bill.status === 'parked' || bill.status === 'draft' || bill.bill_number?.toLowerCase().includes('draft');
  const isDue    = bill.status === 'due';

  // GST summary: group items by GST rate
  const gstGroups = (bill.items || []).reduce((acc, item) => {
    const rate = item.gst_percent || 0;
    if (!acc[rate]) acc[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
    const taxable = (item.line_total || 0) / (1 + rate / 100);
    const gst     = (item.line_total || 0) - taxable;
    acc[rate].taxable += taxable;
    acc[rate].cgst    += gst / 2;
    acc[rate].sgst    += gst / 2;
    acc[rate].total   += gst;
    return acc;
  }, {});

  const gstRows = Object.entries(gstGroups).filter(([, v]) => v.total > 0);

  return (
    <div className="px-8 py-6 print:p-0" data-testid="bill-detail-page">
      {/* ── Toolbar (hidden on print) ── */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate('/billing')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bills
        </Button>
        <div className="flex gap-2">
          {!isParked && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          )}
          <Button onClick={() => navigate(`/billing/edit/${bill.id}`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Bill
          </Button>
        </div>
      </div>

      {/* ── Bill card ── */}
      <div ref={printRef} className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none">

        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {pharmacy?.pharmacy_name || 'PharmaCare'}
              </h1>
              {pharmacy?.address && (
                <p className="text-sm text-gray-500 mt-1">{pharmacy.address}</p>
              )}
              {pharmacy?.city && (
                <p className="text-sm text-gray-500">
                  {[pharmacy.city, pharmacy.state, pharmacy.pincode].filter(Boolean).join(', ')}
                </p>
              )}
              {pharmacy?.phone && (
                <p className="text-sm text-gray-500">📞 {pharmacy.phone}</p>
              )}
              {pharmacy?.gstin && (
                <p className="text-sm font-medium text-gray-700 mt-1">GSTIN: {pharmacy.gstin}</p>
              )}
              {pharmacy?.drug_license && (
                <p className="text-xs text-gray-500">Drug Lic: {pharmacy.drug_license}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">
                {bill.invoice_type === 'PURCHASE' ? 'Purchase Invoice' : 'Tax Invoice'}
              </div>
              {!isParked && (
                <div className="text-2xl font-bold text-brand font-mono">
                  #{bill.bill_number?.replace(/^#/, '')}
                </div>
              )}
              <BillStatusChip status={bill.status} billNumber={bill.bill_number} />
              <div className="text-sm text-gray-500 mt-2">
                {formatDateShort(bill.created_at)}{' '}
                <span className="text-gray-400">{formatTime(bill.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Customer + Doctor ─────────────────────────────────────────────── */}
        <div className="px-8 py-4 border-b border-gray-100 grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Bill To</div>
            <div className="font-semibold text-gray-800 text-lg">
              {bill.customer_name || 'Counter Sale'}
            </div>
            {bill.customer_mobile && (
              <div className="text-sm text-gray-600 mt-0.5">📞 {bill.customer_mobile}</div>
            )}
          </div>
          {bill.doctor_name && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Referred By</div>
              <div className="font-medium text-gray-800">Dr. {bill.doctor_name}</div>
            </div>
          )}
        </div>

        {/* ─── Items table ──────────────────────────────────────────────────── */}
        <div className="px-8 py-4">
          <table className="w-full text-sm" data-testid="bill-items-table">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">#</th>
                <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Disc%</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GST%</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(bill.items || []).map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-brand-tint">
                  <td className="py-2.5 text-gray-400">{idx + 1}</td>
                  <td className="py-2.5">
                    <div className="font-medium text-gray-800">{item.product_name || item.medicine_name}</div>
                    {item.schedule && (
                      <span className="text-xs text-amber-600 font-medium">Sch {item.schedule}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center text-gray-600 font-mono text-xs">{item.batch_no || '—'}</td>
                  <td className="py-2.5 text-center text-gray-600 text-xs">
                    {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—'}
                  </td>
                  <td className="py-2.5 text-center text-gray-600">₹{(item.mrp || 0).toFixed(2)}</td>
                  <td className="py-2.5 text-center font-medium">{item.quantity}</td>
                  <td className="py-2.5 text-center text-gray-600">
                    {item.disc_percent > 0 ? `${item.disc_percent}%` : '—'}
                  </td>
                  <td className="py-2.5 text-center text-gray-600">
                    {item.gst_percent > 0 ? `${item.gst_percent}%` : '—'}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-800">
                    {formatCurrency(item.line_total || item.total || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── Totals + GST ─────────────────────────────────────────────────── */}
        <div className="px-8 pb-6 grid grid-cols-2 gap-8">
          {/* GST Summary */}
          {gstRows.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-2">GST Breakup</div>
              <table className="w-full text-xs text-gray-600">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-1 text-left font-medium">Rate</th>
                    <th className="py-1 text-right font-medium">Taxable</th>
                    <th className="py-1 text-right font-medium">CGST</th>
                    <th className="py-1 text-right font-medium">SGST</th>
                    <th className="py-1 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {gstRows.map(([rate, g]) => (
                    <tr key={rate} className="border-b border-gray-100">
                      <td className="py-1">{rate}%</td>
                      <td className="py-1 text-right">{formatCurrency(g.taxable)}</td>
                      <td className="py-1 text-right">{formatCurrency(g.cgst)}</td>
                      <td className="py-1 text-right">{formatCurrency(g.sgst)}</td>
                      <td className="py-1 text-right font-medium">{formatCurrency(g.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bill totals */}
          <div className="ml-auto w-64">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(bill.subtotal || 0)}</span>
              </div>
              {(bill.discount || 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(bill.discount)}</span>
                </div>
              )}
              {(bill.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST</span>
                  <span>{formatCurrency(bill.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2 mt-2">
                <span>Total</span>
                <span>{formatCurrency(bill.total_amount || 0)}</span>
              </div>
              {!isParked && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Paid ({bill.payment_method?.toUpperCase() || 'CASH'})</span>
                    <span className="text-green-600">{formatCurrency(bill.paid_amount || 0)}</span>
                  </div>
                  {(bill.due_amount || 0) > 0 && (
                    <div className="flex justify-between font-semibold text-red-600">
                      <span>Balance Due</span>
                      <span>{formatCurrency(bill.due_amount)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer ───────────────────────────────────────────────────────── */}
        <div className="px-8 py-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
          <span>Generated by PharmaCare · {new Date().toLocaleString('en-IN')}</span>
          {bill.cashier_name && <span>Billed by: {bill.cashier_name}</span>}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
