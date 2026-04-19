import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppButton, DeleteConfirmDialog } from '@/components/shared';
import PermissionsMatrix from './PermissionsMatrix';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-gray-400';

export default function RoleDialogs({
  permissions,
  showCreateDialog, onCloseCreate, onSubmitCreate,
  showEditDialog, onCloseEdit, onSubmitEdit,
  formData, onFormChange,
  onTogglePermission, onToggleModule,
  deleteDialog, onCloseDelete, onConfirmDelete,
}) {
  return (
    <>
      {/* Create Role */}
      <Dialog open={showCreateDialog} onOpenChange={onCloseCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
          <form onSubmit={onSubmitCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role Key *</label>
                <input type="text" value={formData.name} onChange={(e) => onFormChange({ ...formData, name: e.target.value })} className={inputCls} placeholder="e.g., store_manager" required />
                <p className="text-xs text-gray-500 mt-1">Lowercase, underscores only</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
                <input type="text" value={formData.display_name} onChange={(e) => onFormChange({ ...formData, display_name: e.target.value })} className={inputCls} placeholder="e.g., Store Manager" required />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Permissions * <span className="text-gray-400 font-normal">({formData.selectedPermissions.length} selected)</span>
              </p>
              <PermissionsMatrix
                permissions={permissions}
                selectedPermissions={formData.selectedPermissions}
                onTogglePermission={onTogglePermission}
                onToggleModule={onToggleModule}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <AppButton type="button" variant="secondary" onClick={onCloseCreate}>Cancel</AppButton>
              <AppButton type="submit">Create Role</AppButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role */}
      <Dialog open={showEditDialog} onOpenChange={onCloseEdit}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Role</DialogTitle></DialogHeader>
          <form onSubmit={onSubmitEdit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
              <input type="text" value={formData.display_name} onChange={(e) => onFormChange({ ...formData, display_name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Permissions * <span className="text-gray-400 font-normal">({formData.selectedPermissions.length} selected)</span>
              </p>
              <PermissionsMatrix
                permissions={permissions}
                selectedPermissions={formData.selectedPermissions}
                onTogglePermission={onTogglePermission}
                onToggleModule={onToggleModule}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <AppButton type="button" variant="secondary" onClick={onCloseEdit}>Cancel</AppButton>
              <AppButton type="submit">Update Role</AppButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        itemName={deleteDialog.roleName ? `role "${deleteDialog.roleName}"` : 'this role'}
        isLoading={deleteDialog.loading}
      />
    </>
  );
}
