/**
 * DigitalReceiptPreview — live preview of the Digital (shareable) receipt.
 * Same A4-style item table/totals as BillPreview's A4 branch, but the
 * header is either the default banner or a custom uploaded image, and the
 * footer is an image (or nothing) instead of free text.
 */
import React from 'react';

interface PrintSettings {
  print_gstin?: boolean;
  print_drug_license?: boolean;
  print_fssai?: boolean;
  print_pan?: boolean;
  print_patient_name?: boolean;
  print_signature?: boolean;
}

interface DigitalSettings {
  use_default_header?: boolean;
  header_image_url?: string;
  footer_image_url?: string;
  header_height_px?: number;
  footer_height_px?: number;
  header_text?: string;
  footer_text?: string;
}

interface GeneralSettings {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  gstin?: string;
  drug_license_number?: string;
  fssai_number?: string;
  pan_number?: string;
  logo_url?: string;
}

interface Props {
  digital: DigitalSettings;
  print: PrintSettings;
  general: GeneralSettings;
}

const MOCK_ITEMS = [
  { name: 'Amoxicillin 500mg Tab', mfr: 'Cipla Ltd', hsn: '3004', sch: 'H',   pack: '10 tab', batch: 'B24-1122', qty: 2, mrp: 1400, disc: 5, gst: 12 },
  { name: 'Paracetamol 650mg Tab', mfr: 'GSK',       hsn: '3004', sch: 'OTC', pack: '15 tab', batch: 'B24-0891', qty: 3, mrp: 500,  disc: 0, gst: 5  },
];

function paise(p: number) {
  return `₹${(p / 100).toFixed(2)}`;
}

function dPrice(item: typeof MOCK_ITEMS[0]) {
  return Math.round((item.mrp * (100 - item.disc)) / 100);
}

export default function DigitalReceiptPreview({ digital, print, general }: Props) {
  const name = general.name || 'Your Pharmacy Name';
  const address = [general.address, general.city, general.state, general.pincode].filter(Boolean).join(', ');
  const useDefault = digital.use_default_header !== false;
  const grandTotal = MOCK_ITEMS.reduce((s, i) => s + dPrice(i) * i.qty, 0);

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Live Preview</p>
      <div className="overflow-auto">
        <div
          className="bg-white shadow-lg rounded border border-gray-200 text-[11px]"
          style={{ fontFamily: "'IBM Plex Sans', sans-serif", maxWidth: 700 }}
          data-testid="digital-receipt-preview"
        >
          {useDefault ? (
            <div className="flex justify-between items-start px-6 py-4 bg-sidebar text-white">
              <div className="flex items-center gap-2.5">
                {general.logo_url && (
                  <img src={general.logo_url} alt="logo" className="w-8 h-8 object-contain rounded-lg bg-white/10 p-1" />
                )}
                <div>
                  <p className="font-bold text-[14px]">{name}</p>
                  {digital.header_text && <p className="text-[9px] mt-0.5 text-white/50">{digital.header_text}</p>}
                  {address && <p className="text-[9px] mt-0.5 text-white/50">{address}</p>}
                  {general.phone && <p className="text-[9px] mt-0.5 text-white/50">Ph: {general.phone}</p>}
                  <p className="text-[9px] mt-0.5 text-white/50">
                    {[
                      print.print_gstin && general.gstin && `GSTIN: ${general.gstin}`,
                      print.print_drug_license && general.drug_license_number && `DL: ${general.drug_license_number}`,
                      print.print_fssai && general.fssai_number && `FSSAI: ${general.fssai_number}`,
                      print.print_pan && general.pan_number && `PAN: ${general.pan_number}`,
                    ].filter(Boolean).join('  |  ')}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-[16px] tracking-wide">INVOICE</p>
                <p className="text-[10px] mt-1 text-white/70">INV-000123 &middot; 19 Apr 2026</p>
                <p className="text-[10px] text-white/70">Payment: Cash</p>
              </div>
            </div>
          ) : digital.header_image_url ? (
            <img
              src={digital.header_image_url}
              alt="Header"
              className="w-full object-cover"
              style={{ height: digital.header_height_px ?? 100 }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-gray-50 border-b border-dashed border-gray-300 text-gray-400 text-xs"
              style={{ height: digital.header_height_px ?? 100 }}
            >
              No header image uploaded
            </div>
          )}
          {!useDefault && digital.header_text && (
            <p className="px-6 py-1 text-[9px] text-gray-500 border-b border-gray-100">{digital.header_text}</p>
          )}

          {/* Single line — patient + billing. Invoice number/date/payment
              live in the header when it's the default banner (like Print);
              a custom image header has no room for them, so they fold into
              this line instead — either way, one line, not separate blocks. */}
          <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b border-gray-200 bg-gray-50 text-[10px]">
            <div className="text-gray-700 truncate">
              {!useDefault && <>INV-000123 &middot; 19 Apr 2026 &middot; Cash &middot; &nbsp;</>}
              {print.print_patient_name
                ? <>Patient: <span className="font-semibold text-gray-900">Ravi Shankar</span> &middot; Ph: +91 98400 12345 &middot; Ref. By: Dr. Susmita Sarkar</>
                : <span className="text-gray-400 italic">Patient name hidden &middot; Ref. By: Dr. Susmita Sarkar</span>
              }
            </div>
            <div className="text-gray-500 shrink-0">Billed By: Rajan Kumar</div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-t border-b border-gray-200 bg-gray-50">
                {['Medicine (Mfr / HSN / Sch / Pack)', 'Batch', 'MRP', 'Qty', 'Disc%', 'D.Price', 'GST%', 'Amount'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[8px] font-bold uppercase tracking-wide text-gray-400 text-left last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_ITEMS.map((item) => (
                <tr key={item.name} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-[9px] text-gray-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {item.mfr} · HSN {item.hsn} · Sch {item.sch} · {item.pack}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{item.batch}</td>
                  <td className="px-3 py-2">{paise(item.mrp)}</td>
                  <td className="px-3 py-2 text-center">{item.qty}</td>
                  <td className="px-3 py-2 text-center">{item.disc}%</td>
                  <td className="px-3 py-2">{paise(dPrice(item))}</td>
                  <td className="px-3 py-2 text-center">{item.gst}%</td>
                  <td className="px-3 py-2 text-right font-semibold">{paise(dPrice(item) * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end border-t border-gray-200">
            <div className="w-64 px-5 py-3">
              <div className="flex justify-between">
                <span className="font-bold text-gray-900 text-[13px]">Grand Total</span>
                <span className="font-bold text-[15px] text-brand">{paise(grandTotal)}</span>
              </div>
            </div>
          </div>

          {digital.footer_image_url ? (
            <img
              src={digital.footer_image_url}
              alt="Footer"
              className="w-full object-cover border-t border-gray-200"
              style={{ height: digital.footer_height_px ?? 60 }}
            />
          ) : (
            <div className="px-5 py-3 border-t border-gray-200 text-[9px] text-gray-400">
              No footer image — this line stays blank on the real receipt.
            </div>
          )}
          {digital.footer_text && (
            <p className="px-5 py-2 text-[9px] text-gray-500 border-t border-gray-100">{digital.footer_text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
