/**
 * BillDetail — read-only view of a completed/parked bill.
 * Route: /billing/:id
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Download, Edit, RotateCcw } from 'lucide-react';
import { AppButton, PageSkeleton, PageBreadcrumb } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { downloadBlob, extractBlobErrorMessage } from '@/utils/fileDownload';
import A4BillView from './components/A4BillView';
import ThermalBillView from './components/ThermalBillView';

export default function BillDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [bill, setBill]       = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [printSettings, setPrintSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  // Settings → Receipt & Print → Paper Size — found Sep 22, 2026 (Receipt &
  // Print product-review): this on-screen preview (also what window.print()
  // prints, and the same data GET /bills/{id}/pdf's Download builds from)
  // always rendered the wide A4-style card regardless of this setting, so
  // an 80mm/58mm-thermal pharmacy's reprint never matched their original
  // Save & Print. ThermalBillView now mirrors that layout for those sizes.
  const isThermal = printSettings?.paper_size === '80mm' || printSettings?.paper_size === '58mm';
  const BillView = isThermal ? ThermalBillView : A4BillView;

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

      <BillView
        bill={bill}
        pharmacy={pharmacy}
        printSettings={printSettings}
        isParked={isParked}
        gstRows={gstRows}
        showGstin={showGstin}
        showDrugLic={showDrugLic}
        showFssai={showFssai}
        showPan={showPan}
        showPatientName={showPatientName}
        showSignature={showSignature}
      />

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
