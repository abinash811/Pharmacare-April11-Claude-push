/**
 * DrugLicenseRequiredState — blocking state shown instead of the billing
 * workspace when the pharmacy has no valid Drug License on file. Mirrors
 * Stripe's "restricted mode" pattern: the account works fine everywhere
 * else, only the specific action that legally requires it is blocked.
 * Props:
 *   expired {boolean} — true if a DL number exists but is past its expiry
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AppButton } from '@/components/shared';

interface Props {
  expired?: boolean;
}

export default function DrugLicenseRequiredState({ expired = false }: Props) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center" data-testid="drug-license-gate">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {expired ? 'Drug License has expired' : 'Drug License required to create bills'}
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {expired
          ? 'Your Drug License on file has expired. Renew it and update the expiry date in Pharmacy Profile before billing.'
          : "Add your Drug License Number in Pharmacy Profile before creating bills — it's required to legally sell scheduled drugs."}
      </p>
      <AppButton onClick={() => navigate('/settings')} data-testid="dl-gate-settings-btn">
        Go to Pharmacy Profile
      </AppButton>
    </div>
  );
}
