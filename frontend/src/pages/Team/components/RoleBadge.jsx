import React from 'react';

const ROLE_MAP = {
  admin:           { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: 'Admin' },
  manager:         { cls: 'bg-blue-50 text-blue-700 border border-blue-200',       label: 'Manager' },
  cashier:         { cls: 'bg-green-50 text-green-700 border border-green-200',    label: 'Cashier' },
  inventory_staff: { cls: 'bg-amber-50 text-amber-700 border border-amber-200',    label: 'Inventory Staff' },
};

export default function RoleBadge({ role }) {
  const { cls, label } = ROLE_MAP[role] ?? { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: role };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}
