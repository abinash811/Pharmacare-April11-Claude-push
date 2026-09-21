import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { AppButton } from '@/components/shared';

export default function PermissionsMatrix({ permissions, selectedPermissions, onTogglePermission, onToggleModule, onToggleAll }) {
  const allIds = Object.values(permissions).flatMap((mod) => mod.permissions.map((p) => p.id));
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedPermissions.includes(id));

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
        <span className="text-xs text-gray-500">{selectedPermissions.length} of {allIds.length} permissions selected</span>
        <AppButton variant="ghost" size="sm" type="button" onClick={onToggleAll} data-testid="permissions-select-all">
          {allSelected ? 'Deselect All' : 'Select All'}
        </AppButton>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Object.keys(permissions).map((moduleKey) => {
        const mod = permissions[moduleKey];
        const ids = mod.permissions.map((p) => p.id);
        const allOn  = ids.every((id) => selectedPermissions.includes(id));
        const someOn = ids.some((id)  => selectedPermissions.includes(id));
        return (
          <div key={moduleKey} className="bg-white rounded-lg p-3 border border-gray-100">
            <AppButton variant="ghost" type="button" onClick={() => onToggleModule(moduleKey)} className="flex items-center gap-2 w-full mb-2">
              {allOn ? (
                <CheckSquare className="h-4 w-4 text-brand flex-shrink-0" strokeWidth={1.5} />
              ) : someOn ? (
                <Square className="h-4 w-4 text-brand/50 flex-shrink-0" strokeWidth={1.5} />
              ) : (
                <Square className="h-4 w-4 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
              )}
              <span className="text-sm font-medium text-gray-800">{mod.display_name}</span>
            </AppButton>
            <div className="ml-6 space-y-1">
              {mod.permissions.map((perm) => (
                <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => onTogglePermission(perm.id)}
                    className="accent-brand"
                  />
                  <span className="text-sm text-gray-700">{perm.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
