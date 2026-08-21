/**
 * buildPrintPharmacyInfo — pharmacy identity for the printed receipt,
 * respecting the Show-on-Bill toggles from Settings > Receipt & Print.
 * Same fields the backend PDF and the Settings preview already show.
 *
 * @param {object} general  — settings.general (pharmacy profile)
 * @param {object} print    — settings.print (paper size, toggles, header/footer text)
 */
export function buildPrintPharmacyInfo(general, print) {
  const g = general || {};
  const p = print || {};
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
  };
}
