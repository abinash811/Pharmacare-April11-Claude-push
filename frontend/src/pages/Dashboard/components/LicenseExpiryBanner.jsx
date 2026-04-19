/**
 * LicenseExpiryBanner — amber strip shown above metric cards when drug license is expiring soon.
 * Shown only when license_alert.enabled === true from dashboard API.
 */
import React, { useState } from 'react';
import { AlertTriangle, X, Settings } from 'lucide-react';

export default function LicenseExpiryBanner({ licenseAlert, onNavigate }) {
  const [dismissed, setDismissed] = useState(false);

  if (!licenseAlert?.enabled || dismissed) return null;

  const { days_left, expiry_date } = licenseAlert;

  const isExpired   = days_left !== null && days_left < 0;
  const isCritical  = days_left !== null && days_left <= 30;
  const expiryLabel = expiry_date
    ? new Date(expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const bgClass     = isCritical ? 'bg-red-50  border-red-200'   : 'bg-amber-50 border-amber-200';
  const textClass   = isCritical ? 'text-red-800'                : 'text-amber-800';
  const iconClass   = isCritical ? 'text-red-500'                : 'text-amber-500';
  const btnClass    = isCritical
    ? 'text-red-700 hover:text-red-900 hover:bg-red-50'
    : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50';

  const message = isExpired
    ? `Drug license expired on ${expiryLabel}. Renew immediately — selling medicines without a valid license is illegal.`
    : `Drug license expires on ${expiryLabel} — ${days_left} day${days_left === 1 ? '' : 's'} remaining. Renew before it lapses.`;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 mb-5 rounded-xl border ${bgClass}`} role="alert">
      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} strokeWidth={2} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textClass}`}>{message}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onNavigate?.('/settings')}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${btnClass}`}
        >
          <Settings className="w-3.5 h-3.5" />
          Update in Settings
        </button>
        <button
          onClick={() => setDismissed(true)}
          className={`p-1 rounded-lg transition-colors ${btnClass}`}
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
