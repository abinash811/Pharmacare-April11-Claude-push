import React from 'react';

/**
 * Status badge color mappings
 */
const STATUS_STYLES = {
  // Payment statuses
  paid: 'bg-green-50 text-green-700',
  cash: 'bg-green-50 text-green-700',
  completed: 'bg-green-50 text-green-700',
  active: 'bg-green-50 text-green-700',
  confirmed: 'bg-green-50 text-green-700',
  
  // Warning/pending statuses - Amber for warnings
  due: 'bg-amber-50 text-amber-700',
  unpaid: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-red-50 text-red-700',
  inactive: 'bg-red-50 text-red-700',
  
  // Partial/pending statuses
  partial: 'bg-amber-50 text-amber-700',
  parked: 'bg-amber-50 text-amber-700',
  pending: 'bg-amber-50 text-amber-700',
  draft: 'bg-amber-50 text-amber-700',
  
  // Info statuses
  upi: 'bg-blue-50 text-blue-700',
  credit: 'bg-purple-50 text-purple-700',
  card: 'bg-purple-50 text-purple-700',
  adjusted: 'bg-purple-50 text-purple-700',
  
  // Sales returns specific - human readable labels
  same_as_original: 'bg-gray-100 text-gray-700',
  credit_to_account: 'bg-purple-50 text-purple-700',
  
  // Customer types
  regular: 'bg-blue-50 text-blue-700',
  wholesale: 'bg-purple-50 text-purple-700',
  institution: 'bg-green-50 text-green-700',
  
  // Default
  default: 'bg-gray-100 text-gray-700'
};

/**
 * Human readable label mappings for database values
 */
const LABEL_MAPPINGS = {
  'same_as_original': 'Same as Original',
  'credit_to_account': 'Credit to Account',
  'adjust_outstanding': 'Adjusted'
};

/**
 * StatusBadge - Consistent status badge component
 * Matches the Customers page design reference
 * 
 * @param {Object} props
 * @param {string} props.status - Status value (case-insensitive)
 * @param {string} props.label - Optional custom label (defaults to capitalized status)
 * @param {string} props.fallback - Fallback text for null/undefined status (default: depends on context)
 * @param {string} props.className - Optional additional classes
 */
export function StatusBadge({ status, label, fallback = '-', className = '' }) {
  // Handle null/undefined/empty status - never show NaN
  if (!status || status === 'NaN' || (typeof status === 'string' && !status.trim())) {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES.default} ${className}`}>
        {fallback}
      </span>
    );
  }
  
  const normalizedStatus = status.toLowerCase().trim();
  const styleClass = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.default;
  
  // Display label: use provided label, or check LABEL_MAPPINGS, or capitalize the status
  let displayLabel = label;
  if (!displayLabel) {
    displayLabel = LABEL_MAPPINGS[normalizedStatus] || (status.charAt(0).toUpperCase() + status.slice(1).toLowerCase());
  }
  
  return (
    <span 
      className={`px-2 py-1 rounded-full text-xs font-medium ${styleClass} ${className}`}
      data-testid={`status-badge-${normalizedStatus}`}
    >
      {displayLabel}
    </span>
  );
}

/**
 * CustomerTypeBadge - Specialized badge for customer types
 * Always shows "Regular" for unknown types (never NaN)
 */
export function CustomerTypeBadge({ type }) {
  const safeType = type && typeof type === 'string' && type.trim() ? type : 'regular';
  return <StatusBadge status={safeType} fallback="Regular" />;
}

/**
 * PaymentStatusBadge - Specialized badge for payment statuses
 */
export function PaymentStatusBadge({ status, paymentMethod }) {
  // Determine display based on status and payment method
  if (status === 'parked' || status === 'draft') {
    return <StatusBadge status="parked" label="Parked" />;
  }
  if (status === 'due' || status === 'unpaid') {
    return <StatusBadge status="due" label="Due" />;
  }
  if (status === 'partial') {
    return <StatusBadge status="partial" label="Partial" />;
  }
  if (status === 'paid') {
    // Show payment method for paid bills
    const method = paymentMethod?.toLowerCase();
    if (method === 'upi') return <StatusBadge status="upi" label="UPI" />;
    if (method === 'card' || method === 'cc/dc') return <StatusBadge status="card" label="Card" />;
    if (method === 'credit') return <StatusBadge status="credit" label="Credit" />;
    return <StatusBadge status="cash" label="Cash" />;
  }
  return <StatusBadge status={status || 'pending'} />;
}
