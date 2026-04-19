import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

export default function PermissionsMatrix({ permissions, selectedPermissions, onTogglePermission, onToggleModule }) {
  return (
    <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
      {Object.keys(permissions).map((moduleKey) => {
        const module = permissions[moduleKey];
        const moduleIds = module.permissions.map((p) => p.id);
        const allSelected  = moduleIds.every((id) => selectedPermissions.includes(id));
        const someSelected = moduleIds.some((id) => selectedPermissions.includes(id));

        return (
          <div key={moduleKey} className="mb-4 bg-white rounded-lg p-3 border border-gray-100">
            <div className="flex items-center mb-2 cursor-pointer" onClick={() => onToggleModule(moduleKey)}>
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-brand mr-2" strokeWidth={1.5} />
              ) : someSelected ? (
                <Square className="w-5 h-5 text-brand/50 mr-2" strokeWidth={1.5} />
              ) : (
                <Square className="w-5 h-5 text-gray-400 mr-2" strokeWidth={1.5} />
              )}
              <span className="text-sm font-medium text-gray-800">{module.display_name}</span>
            </div>
            <div className="ml-7 space-y-1">
              {module.permissions.map((perm) => (
                <label key={perm.id} className="flex items-center cursor-pointer hover:bg-brand-tint p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => onTogglePermission(perm.id)}
                    className="mr-2 accent-brand"
                  />
                  <span className="text-sm text-gray-700">{perm.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
