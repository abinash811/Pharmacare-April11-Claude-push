/**
 * DoctorsTable — table only. CTAs live in the Customers orchestrator.
 *
 * Props:
 *   doctors     {Array}
 *   searchQuery {string}
 *   onAdd       {() => void}
 *   onEdit      {(d) => void}
 *   onDelete    {(d) => void}
 */
import React from 'react';
import { Edit, Trash2, Phone, Stethoscope } from 'lucide-react';
import { EmptyState, AppButton } from '@/components/shared';

export default function DoctorsTable({ doctors, searchQuery, onAdd, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="doctors-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                { label: 'Doctor',         align: 'text-left'  },
                { label: 'Contact',        align: 'text-left'  },
                { label: 'Specialization', align: 'text-left'  },
                { label: 'Actions',        align: 'text-right' },
              ].map(({ label, align }) => (
                <th key={label} className={`px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider ${align}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doctors.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState
                    icon={Stethoscope}
                    title={searchQuery ? 'No doctors match your search' : 'No doctors yet'}
                    description={searchQuery ? 'Try a different search term' : 'Add referring doctors to track referrals'}
                  />
                </td>
              </tr>
            ) : doctors.map(doctor => (
              <tr key={doctor.id} className="group h-10 border-b border-gray-100 last:border-0 hover:bg-brand-tint">
                <td className="px-4 py-2.5">
                  <div className="text-sm font-medium text-gray-900">Dr. {doctor.name}</div>
                  {doctor.clinic_address && (
                    <div className="text-xs text-gray-500">{doctor.clinic_address}</div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {doctor.contact && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Phone className="w-3 h-3 text-gray-400" />{doctor.contact}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {doctor.specialization
                    ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{doctor.specialization}</span>
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AppButton
                      variant="ghost"
                      iconOnly
                      icon={<Edit className="w-3.5 h-3.5" />}
                      aria-label="Edit"
                      className="h-7 w-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      onClick={() => onEdit(doctor)}
                    />
                    <AppButton
                      variant="ghost"
                      iconOnly
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      aria-label="Delete"
                      className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(doctor)}
                    />
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
