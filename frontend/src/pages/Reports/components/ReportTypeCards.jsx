/**
 * ReportTypeCards — 4 clickable report category cards.
 * Props:
 *   activeReport  {string}
 *   onSelect      {(type: string) => void}
 */
import React from 'react';
import { TrendingUp, AlertCircle, Clock, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const REPORT_TYPES = [
  { id: 'sales',     label: 'Sales Report',   sub: 'Daily & monthly sales',   Icon: TrendingUp, iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   ring: 'ring-blue-500' },
  { id: 'low-stock', label: 'Low Stock',      sub: 'Items to reorder',         Icon: AlertCircle, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', ring: 'ring-orange-500' },
  { id: 'expiry',    label: 'Expiry Report',  sub: 'Expiring soon items',      Icon: Clock,      iconBg: 'bg-red-50',    iconColor: 'text-red-600',    ring: 'ring-red-500' },
  { id: 'inventory', label: 'Stock Report',   sub: 'Current inventory',        Icon: Package,    iconBg: 'bg-green-50',  iconColor: 'text-green-600',  ring: 'ring-green-500' },
];

export default function ReportTypeCards({ activeReport, onSelect }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {REPORT_TYPES.map(({ id, label, sub, Icon, iconBg, iconColor, ring }) => (
        <Card
          key={id}
          className={`cursor-pointer transition-all hover:shadow-md ${activeReport === id ? `ring-2 ${ring}` : ''}`}
          onClick={() => onSelect(id)}
          data-testid={`report-card-${id}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 ${iconBg} rounded-lg`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
