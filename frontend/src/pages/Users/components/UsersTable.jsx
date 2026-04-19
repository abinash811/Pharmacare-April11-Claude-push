import React from 'react';
import { Edit, XCircle, CheckCircle } from 'lucide-react';
import { AppButton, DataCard, InlineLoader, PaginationBar } from '@/components/shared';

function RoleBadge({ role }) {
  const styles = {
    admin:           'bg-purple-50 text-purple-700 border-purple-200',
    manager:         'bg-blue-50 text-blue-700 border-blue-200',
    cashier:         'bg-green-50 text-green-700 border-green-200',
    inventory_staff: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const labels = {
    admin: 'Admin', manager: 'Manager', cashier: 'Cashier', inventory_staff: 'Inventory Staff',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${styles[role] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
      {labels[role] || role}
    </span>
  );
}

export default function UsersTable({ users, loading, pagination, currentUser, onEdit, onDeactivate, onActivate }) {
  return (
    <DataCard>
      {loading ? (
        <div className="p-8 text-center"><InlineLoader text="Loading users..." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="users-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="h-10 hover:bg-brand-tint">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{user.email}</td>
                  <td className="px-4 py-2.5"><RoleBadge role={user.role} /></td>
                  <td className="px-4 py-2.5 text-center">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" strokeWidth={1.5} />Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700 border border-red-200">
                        <XCircle className="w-3 h-3" strokeWidth={1.5} />Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <AppButton variant="ghost" iconOnly icon={<Edit className="h-4 w-4" strokeWidth={1.5} />} aria-label={`Edit ${user.name}`} onClick={() => onEdit(user)} />
                      {user.id !== currentUser?.id && (
                        user.is_active
                          ? <AppButton variant="ghost" iconOnly icon={<XCircle className="h-4 w-4 text-red-500" strokeWidth={1.5} />} aria-label="Deactivate user" onClick={() => onDeactivate(user.id)} />
                          : <AppButton variant="ghost" iconOnly icon={<CheckCircle className="h-4 w-4 text-green-600" strokeWidth={1.5} />} aria-label="Activate user" onClick={() => onActivate(user.id)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar {...pagination} />
    </DataCard>
  );
}
