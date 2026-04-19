// @ts-nocheck
/**
 * PharmacyProfileTab — pharmacy identity, contact, address, compliance.
 * Drag & drop logo, inline validation, expiry warning badge.
 */
import React from 'react';
import { Building2, Phone, MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LogoUpload from './LogoUpload';

interface Props {
  general: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir',
  'Ladakh','Lakshadweep','Puducherry',
];

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-7 first:mt-0">
      <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function drugLicenseExpiryWarning(expiry: string): string | null {
  if (!expiry) return null;
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return 'Drug license has expired. Renew immediately.';
  if (days < 90) return `Drug license expires in ${days} days. Renew soon.`;
  return null;
}

function validate(key: string, value: string): string {
  if (key === 'gstin'      && value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value))
    return 'Invalid GSTIN format';
  if (key === 'phone'      && value && !/^[6-9]\d{9}$/.test(value))
    return 'Must be a valid 10-digit Indian mobile number';
  if (key === 'pincode'    && value && !/^\d{6}$/.test(value))
    return 'Pincode must be 6 digits';
  if (key === 'pan_number' && value && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value))
    return 'Invalid PAN format (e.g. ABCDE1234F)';
  return '';
}

export default function PharmacyProfileTab({ general, onUpdate }: Props) {
  const dlWarning = drugLicenseExpiryWarning(general.drug_license_expiry);

  return (
    <div className="max-w-2xl">

      {/* Logo */}
      <SectionHeading icon={<Building2 className="w-3.5 h-3.5" />} title="Pharmacy Identity" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <LogoUpload
          value={general.logo_url || ''}
          onChange={v => onUpdate('logo_url', v)}
        />
        <Field label="Pharmacy Name *" error={!general.name ? 'Required' : ''}>
          <Input
            value={general.name || ''}
            onChange={e => onUpdate('name', e.target.value)}
            placeholder="e.g. Krishna Medical Store"
          />
        </Field>
      </div>

      {/* Contact */}
      <SectionHeading icon={<Phone className="w-3.5 h-3.5" />} title="Contact" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Phone *" error={validate('phone', general.phone)}>
          <Input
            value={general.phone || ''}
            onChange={e => onUpdate('phone', e.target.value)}
            placeholder="10-digit mobile"
            maxLength={10}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={general.email || ''}
            onChange={e => onUpdate('email', e.target.value)}
            placeholder="pharmacy@email.com"
          />
        </Field>
      </div>

      {/* Address */}
      <SectionHeading icon={<MapPin className="w-3.5 h-3.5" />} title="Address" />
      <div className="space-y-4">
        <Field label="Street Address *">
          <Input
            value={general.address || ''}
            onChange={e => onUpdate('address', e.target.value)}
            placeholder="Shop No, Street, Area"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="City *">
            <Input value={general.city || ''} onChange={e => onUpdate('city', e.target.value)} placeholder="City" />
          </Field>
          <Field label="State *">
            <select
              value={general.state || ''}
              onChange={e => onUpdate('state', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Pincode *" error={validate('pincode', general.pincode)}>
            <Input value={general.pincode || ''} onChange={e => onUpdate('pincode', e.target.value)} placeholder="6-digit" maxLength={6} />
          </Field>
        </div>
      </div>

      {/* Compliance */}
      <SectionHeading icon={<ShieldCheck className="w-3.5 h-3.5" />} title="Compliance Numbers" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="GSTIN" error={validate('gstin', general.gstin)}>
          <Input
            value={general.gstin || ''}
            onChange={e => onUpdate('gstin', e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />
        </Field>
        <Field label="PAN Number" error={validate('pan_number', general.pan_number)}>
          <Input
            value={general.pan_number || ''}
            onChange={e => onUpdate('pan_number', e.target.value.toUpperCase())}
            placeholder="AAAAA0000A"
            maxLength={10}
          />
        </Field>
        <Field label="Drug License Number">
          <Input
            value={general.drug_license_number || ''}
            onChange={e => onUpdate('drug_license_number', e.target.value)}
            placeholder="DL No. 20 / DL No. 21"
          />
        </Field>
        <Field label="Drug License Expiry">
          <Input
            type="date"
            value={general.drug_license_expiry || ''}
            onChange={e => onUpdate('drug_license_expiry', e.target.value)}
          />
          {dlWarning && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">{dlWarning}</p>
            </div>
          )}
        </Field>
        <Field label="FSSAI Number">
          <Input
            value={general.fssai_number || ''}
            onChange={e => onUpdate('fssai_number', e.target.value)}
            placeholder="14-digit FSSAI licence"
            maxLength={14}
          />
        </Field>
      </div>

    </div>
  );
}
