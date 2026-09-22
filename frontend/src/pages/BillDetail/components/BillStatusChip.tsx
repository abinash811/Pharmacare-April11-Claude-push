import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Props {
  status: string;
  billNumber?: string;
}

export default function BillStatusChip({ status, billNumber }: Props) {
  const isParked = status === 'parked' || status === 'draft' || billNumber?.toLowerCase().includes('draft');
  if (isParked) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
      <Clock className="w-4 h-4" strokeWidth={1.5} /> Parked
    </span>
  );
  if (status === 'due') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">
      <AlertCircle className="w-4 h-4" strokeWidth={1.5} /> Due
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
      <CheckCircle className="w-4 h-4" strokeWidth={1.5} /> Paid
    </span>
  );
}
