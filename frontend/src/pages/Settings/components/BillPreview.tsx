/**
 * BillPreview — live receipt preview matching invoice-print.html design system.
 * IBM Plex Sans + Mono, dark header, meta row, parties, items, GST summary, footer.
 */
import React from 'react';

interface PrintSettings {
  print_logo?:         boolean;
  print_gstin?:        boolean;
  print_drug_license?: boolean;
  print_fssai?:        boolean;
  print_patient_name?: boolean;
  print_signature?:    boolean;
  bill_header?:        string;
  bill_footer?:        string;
  paper_size?:         string;
}

interface GeneralSettings {
  name?:               string;
  address?:            string;
  city?:               string;
  state?:              string;
  pincode?:            string;
  phone?:              string;
  gstin?:              string;
  drug_license_number?:string;
  fssai_number?:       string;
  logo_url?:           string;
}

interface Props {
  print:   PrintSettings;
  general: GeneralSettings;
}

const MOCK_ITEMS = [
  { name: 'Amoxicillin 500mg Tab', mfr: 'Cipla Ltd', batch: 'B24-1122', expiry: 'Nov 2026', qty: 2, mrp: 1400, disc: 5,  gst: 12, schedH: true  },
  { name: 'Paracetamol 650mg Tab', mfr: 'GSK',       batch: 'B24-0891', expiry: 'Dec 2026', qty: 3, mrp:  500, disc: 0,  gst: 5,  schedH: false },
  { name: 'Vitamin D3 60K IU Cap', mfr: 'Sun Pharma',batch: 'B24-1034', expiry: 'Mar 2027', qty: 2, mrp: 4200, disc: 10, gst: 5,  schedH: false },
];

function paise(p: number) { return `₹${(p / 100).toFixed(2)}`; }

function calcItem(item: typeof MOCK_ITEMS[0]) {
  const gross   = item.mrp * item.qty;
  const disc    = Math.round(gross * item.disc / 100);
  const taxable = gross - disc;
  const gst     = Math.round(taxable * item.gst / (100 + item.gst));
  return { gross, disc, taxable, gst, amount: taxable };
}

export default function BillPreview({ print, general }: Props) {
  const name    = general.name    || 'Your Pharmacy Name';
  const address = [general.address, general.city, general.state, general.pincode].filter(Boolean).join(', ');
  const isNarrow = print.paper_size === '58mm' || print.paper_size === '80mm';

  const calcs      = MOCK_ITEMS.map(calcItem);
  const totalDisc  = calcs.reduce((s, c) => s + c.disc,    0);
  const totalTax   = calcs.reduce((s, c) => s + c.gst,     0);
  const grandTotal = calcs.reduce((s, c) => s + c.amount,  0);
  const mrpTotal   = calcs.reduce((s, c) => s + c.gross,   0);

  if (isNarrow) {
    /* ── Thermal / narrow receipt ─────────────────────────────── */
    return (
      <div className="flex flex-col h-full">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Live Preview</p>
        <div className="overflow-auto">
          <div className="mx-auto bg-white shadow-lg border border-gray-200 text-[10px] font-mono px-4 py-4" style={{ maxWidth: print.paper_size === '58mm' ? 200 : 240 }}>
            {print.print_logo && general.logo_url && (
              <img src={general.logo_url} alt="logo" className="h-8 w-auto mx-auto mb-2 object-contain" />
            )}
            <p className="font-bold text-[12px] text-center leading-tight">{name}</p>
            {print.bill_header && <p className="text-center text-[9px] text-gray-500 mt-0.5">{print.bill_header}</p>}
            {address && <p className="text-center text-[9px] text-gray-500 mt-0.5">{address}</p>}
            {general.phone   && <p className="text-center text-[9px]">Ph: {general.phone}</p>}
            {print.print_gstin && general.gstin && <p className="text-center text-[9px]">GSTIN: {general.gstin}</p>}
            {print.print_drug_license && general.drug_license_number && <p className="text-center text-[9px]">DL: {general.drug_license_number}</p>}
            {print.print_fssai && general.fssai_number && <p className="text-center text-[9px]">FSSAI: {general.fssai_number}</p>}

            <div className="border-t border-dashed border-gray-400 my-2" />
            <div className="flex justify-between text-[9px]"><span>Bill: INV-000123</span><span>19 Apr 2026</span></div>
            {print.print_patient_name && <p className="text-[9px] mt-0.5">Patient: Ravi Shankar</p>}
            <div className="border-t border-dashed border-gray-400 my-2" />

            {MOCK_ITEMS.map((item, i) => (
              <div key={i} className="mb-1.5">
                <p className="font-semibold">{item.name}</p>
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>{item.qty} × {paise(item.mrp)}</span>
                  <span>{paise(calcs[i].amount)}</span>
                </div>
              </div>
            ))}

            <div className="border-t border-dashed border-gray-400 my-2" />
            <div className="flex justify-between"><span>Total Disc</span><span className="text-green-700">-{paise(totalDisc)}</span></div>
            <div className="flex justify-between"><span>GST</span><span>{paise(totalTax)}</span></div>
            <div className="flex justify-between font-bold text-[12px] border-t border-gray-400 mt-1 pt-1">
              <span>TOTAL</span><span className="text-brand">{paise(grandTotal)}</span>
            </div>

            {(print.print_signature || print.bill_footer) && (
              <div className="border-t border-dashed border-gray-400 mt-3 pt-2 text-center">
                {print.print_signature && (
                  <div className="mb-2">
                    <div className="border-t border-gray-400 w-24 mx-auto mb-1" />
                    <p className="text-[9px] text-gray-500 uppercase tracking-wide">Authorised Signatory</p>
                  </div>
                )}
                {print.bill_footer && <p className="text-[9px] text-gray-500">{print.bill_footer}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── A4 / A5 invoice ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Live Preview</p>
      <div className="overflow-auto">
        <div className="bg-white shadow-lg rounded border border-gray-200 text-[11px]" style={{ fontFamily: "'IBM Plex Sans', sans-serif", maxWidth: print.paper_size === 'a5' ? 500 : 700 }}>

          {/* Dark header */}
          <div className="flex justify-between items-start px-6 py-4 bg-sidebar text-white">
            <div className="flex items-center gap-2.5">
              {print.print_logo && general.logo_url
                ? <img src={general.logo_url} alt="logo" className="w-8 h-8 object-contain rounded-lg bg-white/10 p-1" />
                : <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand">
                    <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                  </div>
              }
              <div>
                <p className="font-bold text-[14px]">{name}</p>
                {print.bill_header
                  ? <p className="text-[9px] mt-0.5 text-white/50">{print.bill_header}</p>
                  : <p className="text-[9px] mt-0.5 text-white/50">Pharmacy Management System</p>
                }
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-[16px] tracking-wide">TAX INVOICE</p>
              <p className="text-[11px] mt-0.5 text-white/60">INV-000123</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50">
            {[
              { label: 'Bill Date',       value: '19 Apr 2026',  sub: ''       },
              { label: 'Payment',         value: 'Cash',         sub: 'Paid'   },
              { label: 'Billed By',       value: 'Rajan Kumar',  sub: 'Cashier'},
            ].map((cell, i) => (
              <div key={i} className="px-5 py-3 border-r border-gray-200 last:border-r-0">
                <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">{cell.label}</p>
                <p className="font-semibold text-gray-900 text-[11px]">{cell.value}</p>
                {cell.sub && <p className="text-[9px] text-gray-500 mt-0.5">{cell.sub}</p>}
              </div>
            ))}
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="px-5 py-3 border-r border-gray-200">
              <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Sold By</p>
              <p className="font-bold text-gray-900 text-[12px] mb-0.5">{name}</p>
              {address && <p className="text-[10px] text-gray-500">{address}</p>}
              {general.phone && <p className="text-[10px] text-gray-500">Ph: {general.phone}</p>}
              {print.print_gstin && general.gstin && (
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>GSTIN: {general.gstin}</span>
              )}
              {print.print_drug_license && general.drug_license_number && (
                <p className="text-[10px] text-gray-500 mt-1">Drug Lic: {general.drug_license_number}</p>
              )}
              {print.print_fssai && general.fssai_number && (
                <p className="text-[10px] text-gray-500 mt-0.5">FSSAI: {general.fssai_number}</p>
              )}
            </div>
            <div className="px-5 py-3">
              <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Patient / Customer</p>
              {print.print_patient_name
                ? <><p className="font-bold text-gray-900 text-[12px] mb-0.5">Ravi Shankar</p><p className="text-[10px] text-gray-500">Ph: +91 98400 12345</p></>
                : <p className="text-[10px] text-gray-400 italic">Patient name hidden</p>
              }
            </div>
          </div>

          {/* Items table */}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-t border-b border-gray-200 bg-gray-50">
                {['#','Medicine','Batch / Expiry','Qty','GST%','MRP','Disc%','Amount'].map((h, i) => (
                  <th key={i} className="px-2 py-2 text-[8px] font-bold uppercase tracking-wide text-gray-400 text-left last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_ITEMS.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-2">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-[9px] text-gray-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{item.mfr}</p>
                    {item.schedH && <p className="text-[8px] font-semibold text-red-600">⚠ Schedule H</p>}
                  </td>
                  <td className="px-2 py-2 text-[9px] text-gray-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{item.batch}<br/>{item.expiry}</td>
                  <td className="px-2 py-2 text-center">{item.qty}</td>
                  <td className="px-2 py-2 text-center">{item.gst}%</td>
                  <td className="px-2 py-2">{paise(item.mrp)}</td>
                  <td className="px-2 py-2 text-center">{item.disc}%</td>
                  <td className="px-2 py-2 text-right font-semibold">{paise(calcs[i].amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end border-t border-gray-200">
            <div className="w-64 px-5 py-3 space-y-1">
              {[
                { label: 'MRP Total',     value: paise(mrpTotal),         cls: 'text-gray-700' },
                { label: 'Discount',      value: `-${paise(totalDisc)}`,  cls: 'text-green-700' },
                { label: 'GST',           value: paise(totalTax),         cls: 'text-gray-700' },
              ].map((row, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className="text-gray-500">{row.label}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }} className={row.cls}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-bold text-gray-900 text-[13px]">Grand Total</span>
                <span className="font-bold text-[15px] text-brand" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{paise(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end px-5 py-3 border-t border-gray-200">
            <div className="text-[9px] text-gray-500 max-w-xs leading-relaxed">
              {print.bill_footer || 'Thank you for your purchase!'}
              <br /><span className="text-[8px] text-gray-400">This is a computer-generated invoice.</span>
            </div>
            {print.print_signature && (
              <div className="text-right">
                <div className="border-t border-gray-600 w-28 mb-1 ml-auto" />
                <p className="text-[8px] uppercase tracking-widest text-gray-400">Authorised Signatory</p>
                <p className="text-[8px] text-gray-400 mt-0.5">{name}</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
