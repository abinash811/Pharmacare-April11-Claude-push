/**
 * DoctorsTable — doctor rows + empty state.
 * Props:
 *   doctors     {Array}
 *   searchQuery {string}
 *   onAdd       {() => void}
 *   onEdit      {(d) => void}
 *   onDelete    {(d) => void}
 */
import React from 'react';
import { Plus, Edit, Trash2, Phone, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/shared';
import { EmptyState } from '@/components/shared/EmptyState';

export default function DoctorsTable({ doctors, searchQuery, onAdd, onEdit, onDelete }) {
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={onAdd} data-testid="add-doctor-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Doctor
        </Button>
      </div>

      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="doctors-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Doctor','Contact','Specialization','Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {doctors.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-0">
                    <EmptyState
                      icon={Stethoscope}
                      title={searchQuery ? 'No doctors match your search' : 'No doctors yet'}
                      description={searchQuery ? 'Try a different search term' : 'Add referring doctors to track referrals'}
                      action={
                        <Button onClick={onAdd} data-testid="empty-add-doctor-btn">
                          <Plus className="w-4 h-4 mr-2" />Add Doctor
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                doctors.map(doctor => (
                  <tr key={doctor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">Dr. {doctor.name}</div>
                      {doctor.clinic_address && <div className="text-xs text-gray-500">{doctor.clinic_address}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {doctor.contact && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />{doctor.contact}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {doctor.specialization
                        ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{doctor.specialization}</span>
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEdit(doctor)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(doctor)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
