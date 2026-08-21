/**
 * isDrugLicenseValid — a pharmacy must have a non-blank Drug License Number,
 * and if an expiry date is set, it must not be in the past, before bills can
 * be created. Shared by BillingWorkspace's blocking gate and the Pharmacy
 * Profile completion panel so both agree on what "valid" means.
 */
export function isDrugLicenseValid(general) {
  if (!general?.drug_license_number?.trim()) return false;
  if (general.drug_license_expiry) {
    const expiry = new Date(general.drug_license_expiry);
    if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) return false;
  }
  return true;
}

export function isDrugLicenseExpired(general) {
  if (!general?.drug_license_number?.trim() || !general?.drug_license_expiry) return false;
  const expiry = new Date(general.drug_license_expiry);
  return !Number.isNaN(expiry.getTime()) && expiry < new Date();
}
