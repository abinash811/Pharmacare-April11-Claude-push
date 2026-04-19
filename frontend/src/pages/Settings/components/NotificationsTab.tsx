// @ts-nocheck
/**
 * NotificationsTab — control which in-app alerts fire and when.
 * Each alert card shows a live preview of what the toast looks like.
 * Toast visual matches toasts.html from the design system.
 */
import React from 'react';
import { AlertTriangle, Clock, FileCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch.jsx';

interface Props {
  notifications: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
}

function ToastPreview({ type, title, desc }: { type: 'warning' | 'info'; title: string; desc: string }) {
  const styles = {
    warning: { accent: '#d97706', iconBg: '#fffbeb', iconColor: '#d97706' },
    info:    { accent: '#4682B4', iconBg: '#eff6ff', iconColor: '#4682B4' },
  };
  const s = styles[type];

  return (
    <div className="flex items-start gap-2.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm max-w-xs relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: s.accent }} />
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: s.iconBg }}>
        {type === 'warning'
          ? <AlertTriangle className="w-2.5 h-2.5" style={{ color: s.iconColor }} />
          : <Clock className="w-2.5 h-2.5" style={{ color: s.iconColor }} />
        }
      </div>
      <div>
        <p className="text-[12px] font-semibold text-gray-900 leading-tight">{title}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{desc}</p>
      </div>
    </div>
  );
}

function AlertCard({ icon, title, description, enabled, onToggle, children }: {
  icon: React.ReactNode; title: string; description: string;
  enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-colors ${enabled ? 'border-brand/20 bg-brand/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-start justify-between p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${enabled ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-400'}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      {enabled && children && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function DaysInput({ label, value, onChange, min = 1, max = 365 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-600">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-brand hover:text-brand text-sm font-bold transition-colors"
        >−</button>
        <span className="w-12 text-center text-sm font-semibold text-gray-900">{value} days</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-brand hover:text-brand text-sm font-bold transition-colors"
        >+</button>
      </div>
    </div>
  );
}

export default function NotificationsTab({ notifications, onUpdate }: Props) {
  const lowStockEnabled    = !!notifications.alert_low_stock_enabled;
  const nearExpiryEnabled  = !!notifications.alert_near_expiry_enabled;
  const drugLicenseEnabled = !!notifications.alert_drug_license_enabled;

  const lowStockDays    = Number(notifications.low_stock_threshold_days)  || 30;
  const nearExpiryDays  = Number(notifications.near_expiry_days)          || 90;
  const drugLicenseDays = Number(notifications.drug_license_alert_days)   || 90;

  return (
    <div className="max-w-xl space-y-4">

      <p className="text-xs text-gray-500 mb-6">
        These alerts appear as in-app notifications when conditions are met. They do not send emails or SMS.
      </p>

      {/* Low stock */}
      <AlertCard
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Low Stock Alert"
        description="Triggered when a medicine's stock falls below the threshold"
        enabled={lowStockEnabled}
        onToggle={v => onUpdate('alert_low_stock_enabled', v)}
      >
        <DaysInput
          label="Alert when stock will last less than"
          value={lowStockDays}
          onChange={v => onUpdate('low_stock_threshold_days', v)}
          min={1} max={180}
        />
        <ToastPreview
          type="warning"
          title="Amoxicillin 500mg — low stock"
          desc={`Only ${lowStockDays} days of stock remaining. Reorder soon.`}
        />
      </AlertCard>

      {/* Near expiry */}
      <AlertCard
        icon={<Clock className="w-4 h-4" />}
        title="Near Expiry Alert"
        description="Triggered when a batch is close to its expiry date"
        enabled={nearExpiryEnabled}
        onToggle={v => onUpdate('alert_near_expiry_enabled', v)}
      >
        <DaysInput
          label="Alert when batch expires within"
          value={nearExpiryDays}
          onChange={v => onUpdate('near_expiry_days', v)}
          min={7} max={365}
        />
        <ToastPreview
          type="warning"
          title="Paracetamol 650mg — expiring soon"
          desc={`Batch B24-0891 expires in ${nearExpiryDays} days.`}
        />
      </AlertCard>

      {/* Drug license */}
      <AlertCard
        icon={<FileCheck className="w-4 h-4" />}
        title="Drug License Expiry Reminder"
        description="Reminds you before your drug license expires"
        enabled={drugLicenseEnabled}
        onToggle={v => onUpdate('alert_drug_license_enabled', v)}
      >
        <DaysInput
          label="Alert before drug license expires"
          value={drugLicenseDays}
          onChange={v => onUpdate('drug_license_alert_days', v)}
          min={7} max={365}
        />
        <ToastPreview
          type="info"
          title="Drug license expiring soon"
          desc={`Your license expires in ${drugLicenseDays} days. Renew to avoid disruption.`}
        />
      </AlertCard>

    </div>
  );
}
