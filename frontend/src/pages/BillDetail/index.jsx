/**
 * BillDetail — read-only view of a completed/parked bill.
 * Route: /billing/:id
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Download, Edit, RotateCcw, CheckCircle, Clock, AlertCircle, Wallet } from 'lucide-react';
import { AppButton, PageSkeleton, PageBreadcrumb } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatDateShort, formatTime } from '@/utils/dates';
import { downloadBlob, extractBlobErrorMessage } from '@/utils/fileDownload';
import CollectPaymentModal from '@/components/CollectPaymentModal';
import BillItemsTable from './components/BillItemsTable';
import BillTotals from './components/BillTotals';

function BillStatusChip({ status, billNumber }) {
  const isParked = status === 'parked' || status === 'draft' || billNumber?.toLowerCase().includes('draft');
  if (isParked) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
      <Clock className="w-4 h-4" strokeWidth={1.5} /> Parked
    </span>
  );
  if (status === 'due') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">
      <AlertCircle className="w-4 h-4" strokeWidth={1.5} /> Due
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
      <CheckCircle className="w-4 h-4" strokeWidth={1.5} /> Paid
    </span>
  );
}

export default function BillDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [bill, setBill]       = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [printSettings, setPrintSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showCollectPayment, setShowCollectPayment] = useState(false);

  // GET /bills/{id}/pdf (reportlab-generated, real, working) had zero UI
  // caller anywhere in the app until now — found while checking Billing's
  // pending list. Print (window.print, above) covers the counter-print
  // case; this covers "give me a portable copy to email/WhatsApp/save."
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await api.get(apiUrl.billPdf(bill.id), { responseType: 'blob' });
      downloadBlob(res.data, `${bill.bill_number}.pdf`, 'application/pdf');
    } catch (err) {
      toast.error(await extractBlobErrorMessage(err, 'Failed to download PDF'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [billRes, settingsRes] = await Promise.all([
        api.get(apiUrl.bill(id)),
        api.get(apiUrl.settings()).catch(() => ({ data: { general: {}, print: {} } })),
      ]);
      setBill(billRes.data);
      setPharmacy(settingsRes.data?.general || {});
      // Print settings (header/footer text + Show-on-Bill toggles) — found
      // Sep 19, 2026 (Abinash, testing): this on-screen invoice preview
      // (also what window.print() actually prints) never fetched these at
      // all, so it silently ignored the same settings the backend PDF
      // (GET /bills/{id}/pdf) already honours. Same source, same shape.
      setPrintSettings(settingsRes.data?.print || {});
    } catch {
      toast.error('Failed to load bill');
      navigate('/billing');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, [id]); // eslint-disable-line

  const refetchBill = async () => {
    try {
      const res = await api.get(apiUrl.bill(id));
      setBill(res.data);
    } catch {
      toast.error('Failed to refresh bill');
    }
  };

  if (loading) return <PageSkeleton />;
  if (!bill)   return null;

  const isParked = bill.status === 'parked' || bill.status === 'draft' || bill.bill_number?.toLowerCase().includes('draft');

  // GST summary by rate
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

  // Show-on-Bill toggles (Settings → Printing) — same fields the backend
  // PDF (GET /bills/{id}/pdf) already reads; this on-screen preview is
  // also what window.print() prints, so it must honour the same toggles
  // instead of always showing everything.
  const showGstin      = printSettings ? printSettings.print_gstin        : true;
  const showDrugLic    = printSettings ? printSettings.print_drug_license : true;
  const showFssai      = printSettings ? printSettings.print_fssai        : false;
  const showPan        = printSettings ? printSettings.print_pan          : false;
  const showPatientName = printSettings ? printSettings.print_patient_name : true;
  const showSignature   = printSettings ? printSettings.print_signature   : false;

  return (
    <div className="px-8 py-6 print:p-0 print-area" data-testid="bill-detail-page">
      {/* Breadcrumb + Toolbar */}
      <div className="max-w-4xl mx-auto mb-4 print:hidden">
        <PageBreadcrumb crumbs={[
          { label: 'Billing', to: '/billing' },
          { label: bill.bill_number ? `#${bill.bill_number.replace(/^#/, '')}` : 'Bill Detail' },
        ]} />
      </div>
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <AppButton variant="ghost" icon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />} onClick={() => navigate('/billing')}>
          Back to Bills
        </AppButton>
        <div className="flex gap-2">
          {!isParked && (
            <>
              <AppButton variant="outline" icon={<Printer className="w-4 h-4" strokeWidth={1.5} />} onClick={() => window.print()}>Print</AppButton>
              <AppButton variant="outline" icon={<Download className="w-4 h-4" strokeWidth={1.5} />} onClick={handleDownloadPdf} disabled={downloadingPdf} data-testid="download-pdf-btn">
                {downloadingPdf ? 'Downloading…' : 'Download PDF'}
              </AppButton>
            </>
          )}
          {bill.status === 'due' && (
            <AppButton icon={<Wallet className="w-4 h-4" strokeWidth={1.5} />} onClick={() => setShowCollectPayment(true)} data-testid="collect-payment-btn">
              Collect Payment
            </AppButton>
          )}
          {/* Sep 15, 2026 product-review: a finalized bill had no return
              entry point at all — "Edit Bill" was correctly hidden here
              (below) since editing a GST invoice post-issue isn't real,
              but that also silently removed the only click path to
              BillingWorkspace's Return action. This button is the real,
              direct fix — a return doesn't need the workspace at all. */}
          {!isParked && (
            <AppButton
              variant="outline"
              icon={<RotateCcw className="w-4 h-4" strokeWidth={1.5} />}
              onClick={() => navigate(`/billing/returns/new?billId=${bill.id}`)}
              data-testid="return-items-btn"
            >
              Return Items
            </AppButton>
          )}
          {/* Same-day edit policy (decided Sep 18, 2026, docs/15_ROADMAP.md):
              a paid/due bill can still be corrected until that day's
              Day-End Closing runs, unless a return already exists against
              it. Always show the button — the backend is the real gate and
              returns a clear reason (return exists / day closed) if it's
              too late; BillingWorkspace surfaces that as a toast. */}
          <AppButton icon={<Edit className="w-4 h-4" strokeWidth={1.5} />} onClick={() => navigate(`/billing/edit/${bill.id}`)}>Edit Bill</AppButton>
        </div>
      </div>

      {/* Bill card */}
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pharmacy?.pharmacy_name || 'PharmaCare'}</h1>
              {pharmacy?.address  && <p className="text-sm text-gray-500 mt-1">{pharmacy.address}</p>}
              {pharmacy?.city     && <p className="text-sm text-gray-500">{[pharmacy.city, pharmacy.state, pharmacy.pincode].filter(Boolean).join(', ')}</p>}
              {pharmacy?.phone    && <p className="text-sm text-gray-500">📞 {pharmacy.phone}</p>}
              {showGstin   && pharmacy?.gstin        && <p className="text-sm font-medium text-gray-700 mt-1">GSTIN: {pharmacy.gstin}</p>}
              {showDrugLic && pharmacy?.drug_license && <p className="text-xs text-gray-500">Drug Lic: {pharmacy.drug_license}</p>}
              {showFssai   && pharmacy?.fssai_number && <p className="text-xs text-gray-500">FSSAI: {pharmacy.fssai_number}</p>}
              {showPan     && pharmacy?.pan_number   && <p className="text-xs text-gray-500">PAN: {pharmacy.pan_number}</p>}
              {printSettings?.bill_header && <p className="text-xs text-gray-500 mt-1">{printSettings.bill_header}</p>}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">
                {bill.invoice_type === 'PURCHASE' ? 'Purchase Invoice' : 'Tax Invoice'}
              </div>
              {!isParked && <div className="text-2xl font-bold text-brand font-mono">#{bill.bill_number?.replace(/^#/, '')}</div>}
              <BillStatusChip status={bill.status} billNumber={bill.bill_number} />
              <div className="text-sm text-gray-500 mt-2">
                {formatDateShort(bill.created_at)} <span className="text-gray-400">{formatTime(bill.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer + Doctor */}
        <div className="px-8 py-4 border-b border-gray-100 grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Bill To</div>
            {showPatientName ? (
              <>
                <div className="font-semibold text-gray-800 text-lg">{bill.customer_name || 'Counter Sale'}</div>
                {bill.customer_mobile && <div className="text-sm text-gray-600 mt-0.5">📞 {bill.customer_mobile}</div>}
              </>
            ) : (
              <div className="text-sm text-gray-400 italic">Patient name hidden</div>
            )}
          </div>
          {bill.doctor_name && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Referred By</div>
              <div className="font-medium text-gray-800">Dr. {bill.doctor_name}</div>
            </div>
          )}
        </div>

        <BillItemsTable items={bill.items} />
        <BillTotals bill={bill} gstRows={gstRows} isParked={isParked} />

        {showSignature && (
          <div className="px-8 pt-6 flex justify-end">
            <div className="text-center text-xs text-gray-600">
              <div className="border-t border-gray-400 w-40 pt-1">Authorised Signatory</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-100 text-xs text-gray-400">
          {printSettings?.bill_footer && <p className="text-center text-gray-500 mb-1">{printSettings.bill_footer}</p>}
          <div className="flex justify-between items-center">
            <span>Generated by PharmaCare · {new Date().toLocaleString('en-IN')}</span>
            {bill.cashier_name && <span>Billed by: {bill.cashier_name}</span>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <CollectPaymentModal
        bill={bill}
        open={showCollectPayment}
        onClose={() => setShowCollectPayment(false)}
        onSuccess={refetchBill}
      />
    </div>
  );
}
