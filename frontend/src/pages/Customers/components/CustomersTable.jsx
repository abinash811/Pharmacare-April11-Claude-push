/**
 * CustomersTable — customer rows + empty state.
 * Props:
 *   customers  {Array}
 *   searchQuery {string}  for empty state message
 *   onAdd      {() => void}
 *   onEdit     {(c) => void}
 *   onDelete   {(c) => void}
 *   onView     {(c) => void}
 *   onExport   {() => void}
 */
import React from 'react';
import { Plus, Edit, Trash2, Eye, Phone, Mail, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataCard, CustomersEmptyState } from '@/components/shared';

function CustomerTypeBadge({ type }) {
  const safeType = type && typeof type === 'string' && type.trim() ? type.toLowerCase() : 'regular';
  const styles = {
    regular:     'bg-blue-100 text-blue-700',
    wholesale:   'bg-purple-100 text-purple-700',
    institution: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[safeType] || styles.regular}`}>
      {safeType.charAt(0).toUpperCase() + safeType.slice(1)}
    </span>
  );
}

export default function CustomersTable({ customers, searchQuery, onAdd, onEdit, onDelete, onView, onExport }) {
  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onExport} data-testid="export-customers-btn">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
        <Button onClick={onAdd} data-testid="add-customer-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="customers-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer','Contact','Type','Credit Limit','Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase ${
                    h === 'Actions' || h === 'Credit Limit' ? 'text-right' : h === 'Type' ? 'text-center' : 'text-left'
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-0">
                    <CustomersEmptyState
                      filtered={!!searchQuery}
                      action={
                        <Button onClick={onAdd} data-testid="empty-add-customer-btn">
                          <Plus className="w-4 h-4 mr-2" />Add Customer
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                customers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{customer.name}</div>
                      {customer.gstin && <div className="text-xs text-gray-500">GSTIN: {customer.gstin}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {customer.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />{customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="w-3 h-3" />{customer.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CustomerTypeBadge type={customer.customer_type} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {customer.credit_limit > 0
                        ? <span className="font-medium">₹{customer.credit_limit.toLocaleString()}</span>
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onView(customer)} data-testid={`view-customer-${customer.id}`}>
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(customer)}>
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(customer)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataCard>
    </>
  );
}
