/**
 * CustomersTable — table only. CTAs live in the Customers orchestrator.
 *
 * Props:
 *   customers   {Array}
 *   searchQuery {string}  — for empty state copy
 *   onAdd       {() => void}
 *   onEdit      {(c) => void}
 *   onDelete    {(c) => void}
 *   onView      {(c) => void}
 */
import React from 'react';
import { Edit, Trash2, Eye, Phone, Mail } from 'lucide-react';
import { CustomersEmptyState } from '@/components/shared';

function CustomerTypeBadge({ type }) {
  const safeType = type && typeof type === 'string' && type.trim() ? type.toLowerCase() : 'regular';
  const styles = {
    regular:     'bg-blue-50 text-blue-700 border border-blue-200',
    wholesale:   'bg-purple-50 text-purple-700 border border-purple-200',
    institution: 'bg-green-50 text-green-700 border border-green-200',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[safeType] || styles.regular}`}>
      {safeType.charAt(0).toUpperCase() + safeType.slice(1)}
    </span>
  );
}

export default function CustomersTable({ customers, searchQuery, onAdd, onEdit, onDelete, onView }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="customers-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                { label: 'Customer',     align: 'text-left'   },
                { label: 'Contact',      align: 'text-left'   },
                { label: 'Type',         align: 'text-center' },
                { label: 'Credit Limit', align: 'text-right'  },
                { label: 'Actions',      align: 'text-right'  },
              ].map(({ label, align }) => (
                <th key={label} className={`px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider ${align}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <CustomersEmptyState filtered={!!searchQuery} action={null} />
                </td>
              </tr>
            ) : customers.map(customer => (
              <tr key={customer.id} className="group h-10 border-b border-gray-100 last:border-0 hover:bg-[#f0f7ff]">
                <td className="px-4 py-2.5">
                  <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                  {customer.gstin && <div className="text-xs text-gray-500 font-mono">GSTIN: {customer.gstin}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {customer.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Phone className="w-3 h-3 text-gray-400" />{customer.phone}
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3 text-gray-400" />{customer.email}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CustomerTypeBadge type={customer.customer_type} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {customer.credit_limit > 0
                    ? <span className="font-semibold tabular-nums text-gray-900">₹{customer.credit_limit.toLocaleString()}</span>
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onView(customer)}
                      className="h-7 w-7 rounded flex items-center justify-center text-gray-400 hover:text-[#4682B4] hover:bg-blue-50 transition-colors"
                      title="View details"
                      data-testid={`view-customer-${customer.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onEdit(customer)}
                      className="h-7 w-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(customer)}
                      className="h-7 w-7 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
