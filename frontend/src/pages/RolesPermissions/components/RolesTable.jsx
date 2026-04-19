import React from 'react';
import { Edit, Trash2, Shield } from 'lucide-react';
import { AppButton, DataCard, InlineLoader } from '@/components/shared';

function RoleTypeBadge({ role }) {
  if (role.is_super_admin) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
      <Shield className="h-3 w-3" strokeWidth={1.5} />Super Admin
    </span>
  );
  if (role.is_default) return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Default</span>
  );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Custom</span>
  );
}

export default function RolesTable({ roles, loading, onEdit, onDelete }) {
  return (
    <DataCard>
      {loading ? (
        <div className="py-16 flex items-center justify-center"><InlineLoader text="Loading roles..." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="roles-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-gray-900">No roles found</p>
                    <p className="text-sm text-gray-500 mt-1">Create your first custom role</p>
                  </td>
                </tr>
              ) : roles.map((role) => (
                <tr key={role.id} className="group h-10 hover:bg-brand-tint">
                  <td className="px-4 py-2.5">
                    <div className="text-sm font-medium text-gray-900">{role.display_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{role.name}</div>
                  </td>
                  <td className="px-4 py-2.5"><RoleTypeBadge role={role} /></td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">
                    {role.permissions.includes('*') || role.is_super_admin
                      ? <span className="text-purple-700 font-medium">All permissions</span>
                      : `${role.permissions.length} permissions`}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {!role.is_default ? (
                        <>
                          <AppButton variant="ghost" iconOnly icon={<Edit className="h-4 w-4" strokeWidth={1.5} />} aria-label={`Edit ${role.display_name}`} onClick={() => onEdit(role)} />
                          <AppButton variant="ghost" iconOnly icon={<Trash2 className="h-4 w-4 text-red-500" strokeWidth={1.5} />} aria-label={`Delete ${role.display_name}`} onClick={() => onDelete(role.id, role.display_name)} />
                        </>
                      ) : <span className="text-xs text-gray-400 italic pr-2">Protected</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}
