import React from 'react';
import { Edit, XCircle, CheckCircle, Users } from 'lucide-react';
import { AppButton, PaginationBar } from '@/components/shared';
import RoleBadge from './RoleBadge';

export default function MembersTable({ users, loading, currentUser, pagination, onEdit, onDeactivate, onActivate }) {
  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-4 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-gray-900">No members found</p>
                  <p className="text-sm text-gray-500 mt-1">Invite your first team member</p>
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="group h-10 border-b border-gray-100 last:border-0 hover:bg-brand-tint">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{u.email}</td>
                <td className="px-4 py-2.5"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-2.5">
                  {u.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                      <CheckCircle className="h-3 w-3" strokeWidth={1.5} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                      <XCircle className="h-3 w-3" strokeWidth={1.5} /> Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <AppButton variant="ghost" iconOnly icon={<Edit className="h-4 w-4" strokeWidth={1.5} />} aria-label={`Edit ${u.name}`}
                      onClick={() => onEdit(u)} />
                    {u.id !== currentUser.id && (
                      u.is_active
                        ? <AppButton variant="ghost" iconOnly icon={<XCircle className="h-4 w-4 text-red-500" strokeWidth={1.5} />} aria-label={`Deactivate ${u.name}`} onClick={() => onDeactivate(u.id)} />
                        : <AppButton variant="ghost" iconOnly icon={<CheckCircle className="h-4 w-4 text-green-600" strokeWidth={1.5} />} aria-label={`Activate ${u.name}`} onClick={() => onActivate(u.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar {...pagination} />
    </div>
  );
}
