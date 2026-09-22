/**
 * buildPrintPharmacyInfo — pharmacy identity for the printed receipt,
 * respecting the Show-on-Bill toggles from Settings > Receipt & Print.
 * Same fields the backend PDF and the Settings preview already show.
 *
 * @param {object} general  — settings.general (pharmacy profile)
 * @param {object} print    — settings.print (paper size, toggles, header/footer text)
 * @param {object} gst      — settings.gst ("Print GST summary on bill" toggle lives
 *   here, not under settings.print — same place the backend PDF and BillDetail's
 *   `show_gst_summary`/`showGstin`-style gates already read it from)
 */
export function buildPrintPharmacyInfo(general, print, gst) {
  const g = general || {};
  const p = print || {};
  const x = gst || {};
  return {
    pharmacy_name:    g.name,
    pharmacy_address: [g.address, g.city, g.state, g.pincode].filter(Boolean).join(', '),
    pharmacy_phone:   g.phone,
    gstin:            p.print_gstin        ? g.gstin                : '',
    drug_license:     p.print_drug_license ? g.drug_license_number  : '',
    fssai:            p.print_fssai        ? g.fssai_number         : '',
    pan:              p.print_pan          ? g.pan_number           : '',
    bill_header:      p.bill_header,
    bill_footer:      p.bill_footer,
    print_signature:  !!p.print_signature,
    print_patient_name: p.print_patient_name !== false,
    print_gst_summary: x.print_gst_summary !== false,
  };
}
