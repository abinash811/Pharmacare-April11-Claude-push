import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppButton, ConfirmDialog } from '@/components/shared';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-gray-400';

export default function UserDialogs({
  showAddDialog, onCloseAdd, onSubmitAdd,
  showEditDialog, onCloseEdit, onSubmitEdit,
  showPasswordDialog, onClosePassword, onSubmitPassword,
  formData, onFormChange,
  passwordData, onPasswordChange,
  availableRoles,
  deactivateDialog, onCloseDeactivate, onConfirmDeactivate,
}) {
  return (
    <>
      {/* Add User */}
      <Dialog open={showAddDialog} onOpenChange={onCloseAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <form onSubmit={onSubmitAdd} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={(e) => onFormChange({ ...formData, name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={formData.email} onChange={(e) => onFormChange({ ...formData, email: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
              <input type="password" value={formData.password} onChange={(e) => onFormChange({ ...formData, password: e.target.value })} className={inputCls} required minLength={6} />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
              <select value={formData.role} onChange={(e) => onFormChange({ ...formData, role: e.target.value })} className={inputCls} required>
                <option value="">Select a role…</option>
                {availableRoles.map((r) => <option key={r.id} value={r.name}>{r.display_name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <AppButton type="button" variant="secondary" onClick={onCloseAdd}>Cancel</AppButton>
              <AppButton type="submit">Create User</AppButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={showEditDialog} onOpenChange={onCloseEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <form onSubmit={onSubmitEdit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={(e) => onFormChange({ ...formData, name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={formData.email} onChange={(e) => onFormChange({ ...formData, email: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
              <select value={formData.role} onChange={(e) => onFormChange({ ...formData, role: e.target.value })} className={inputCls} required>
                <option value="">Select a role…</option>
                {availableRoles.map((r) => <option key={r.id} value={r.name}>{r.display_name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <AppButton type="button" variant="secondary" onClick={onCloseEdit}>Cancel</AppButton>
              <AppButton type="submit">Update User</AppButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password */}
      <Dialog open={showPasswordDialog} onOpenChange={onClosePassword}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change My Password</DialogTitle></DialogHeader>
          <form onSubmit={onSubmitPassword} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current Password *</label>
              <input type="password" value={passwordData.current_password} onChange={(e) => onPasswordChange({ ...passwordData, current_password: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Password *</label>
              <input type="password" value={passwordData.new_password} onChange={(e) => onPasswordChange({ ...passwordData, new_password: e.target.value })} className={inputCls} required minLength={6} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password *</label>
              <input type="password" value={passwordData.confirm_password} onChange={(e) => onPasswordChange({ ...passwordData, confirm_password: e.target.value })} className={inputCls} required minLength={6} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <AppButton type="button" variant="secondary" onClick={onClosePassword}>Cancel</AppButton>
              <AppButton type="submit">Change Password</AppButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateDialog.open}
        onClose={onCloseDeactivate}
        onConfirm={onConfirmDeactivate}
        title="Deactivate User?"
        description="They will no longer be able to sign in."
        confirmLabel="Deactivate"
        isDestructive
        isLoading={deactivateDialog.loading}
      />
    </>
  );
}
