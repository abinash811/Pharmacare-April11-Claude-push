import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  cash: 'bg-green-50 text-green-700',
  completed: 'bg-green-50 text-green-700',
  active: 'bg-green-50 text-green-700',
  confirmed: 'bg-green-50 text-green-700',
  due: 'bg-amber-50 text-amber-700',
  unpaid: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-red-50 text-red-700',
  inactive: 'bg-red-50 text-red-700',
  partial: 'bg-amber-50 text-amber-700',
  parked: 'bg-amber-50 text-amber-700',
  pending: 'bg-amber-50 text-amber-700',
  draft: 'bg-amber-50 text-amber-700',
  upi: 'bg-blue-50 text-blue-700',
  credit: 'bg-purple-50 text-purple-700',
  card: 'bg-purple-50 text-purple-700',
  adjusted: 'bg-purple-50 text-purple-700',
  same_as_original: 'bg-gray-100 text-gray-700',
  credit_to_account: 'bg-purple-50 text-purple-700',
  regular: 'bg-blue-50 text-blue-700',
  wholesale: 'bg-purple-50 text-purple-700',
  institution: 'bg-green-50 text-green-700',
  default: 'bg-gray-100 text-gray-700',
};

const LABEL_MAPPINGS: Record<string, string> = {
  same_as_original: 'Same as Original',
  credit_to_account: 'Credit to Account',
  adjust_outstanding: 'Adjusted',
};

export interface StatusBadgeProps {
  status?: string | null;
  label?: string;
  fallback?: string;
  className?: string;
}

export function StatusBadge({ status, label, fallback = '-', className = '' }: StatusBadgeProps) {
  if (!status || status === 'NaN' || !status.trim()) {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES.default} ${className}`}>
        {fallback}
      </span>
    );
  }

  const normalizedStatus = status.toLowerCase().trim();
  const styleClass = STATUS_STYLES[normalizedStatus] ?? STATUS_STYLES.default;
  const displayLabel = label
    ?? LABEL_MAPPINGS[normalizedStatus]
    ?? (status.charAt(0).toUpperCase() + status.slice(1).toLowerCase());

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${styleClass} ${className}`}
      data-testid={`status-badge-${normalizedStatus}`}
    >
      {displayLabel}
    </span>
  );
}

export interface CustomerTypeBadgeProps {
  type?: string | null;
}

export function CustomerTypeBadge({ type }: CustomerTypeBadgeProps) {
  const safeType = type?.trim() || 'regular';
  return <StatusBadge status={safeType} fallback="Regular" />;
}

export interface PaymentStatusBadgeProps {
  status?: string | null;
  paymentMethod?: string | null;
}

export function PaymentStatusBadge({ status, paymentMethod }: PaymentStatusBadgeProps) {
  if (status === 'parked' || status === 'draft') return <StatusBadge status="parked" label="Parked" />;
  if (status === 'due' || status === 'unpaid')   return <StatusBadge status="due"    label="Due" />;
  if (status === 'partial')                       return <StatusBadge status="partial" label="Partial" />;
  if (status === 'paid') {
    const method = paymentMethod?.toLowerCase();
    if (method === 'upi')                  return <StatusBadge status="upi"   label="UPI" />;
    if (method === 'card' || method === 'cc/dc') return <StatusBadge status="card" label="Card" />;
    if (method === 'credit')               return <StatusBadge status="credit" label="Credit" />;
    return <StatusBadge status="cash" label="Cash" />;
  }
  return <StatusBadge status={status ?? 'pending'} />;
}
