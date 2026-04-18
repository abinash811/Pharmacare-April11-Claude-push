import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { Plus, Edit, Trash2, Shield, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { InlineLoader, DeleteConfirmDialog, DataCard } from '../components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function RolesPermissions() {
  const { user: currentUser } = useContext(AuthContext);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, roleId: null, roleName: '', loading: false });

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    selectedPermissions: [],
  });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.get(apiUrl.roles());
      setRoles(response.data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.get(apiUrl.permissions());
      setPermissions(response.data);
    } catch {
      toast.error('Failed to load permissions');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (formData.selectedPermissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }
    try {
      await api.post(apiUrl.roles(), {
        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: formData.display_name,
        permissions: formData.selectedPermissions,
      });
      toast.success('Role created successfully');
      setShowCreateDialog(false);
      setFormData({ name: '', display_name: '', selectedPermissions: [] });
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create role');
    }
  };

  const handleEditRole = async (e) => {
    e.preventDefault();
    if (formData.selectedPermissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }
    try {
      await api.put(apiUrl.role(selectedRole.id), {
        display_name: formData.display_name,
        permissions: formData.selectedPermissions,
      });
      toast.success('Role updated successfully');
      setShowEditDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeleteRole = (roleId, roleName) => {
    setDeleteDialog({ open: true, roleId, roleName, loading: false });
  };

  const confirmDeleteRole = async () => {
    const { roleId } = deleteDialog;
    if (!roleId) return;
    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await api.delete(apiUrl.role(roleId));
      toast.success('Role deleted successfully');
      setDeleteDialog({ open: false, roleId: null, roleName: '', loading: false });
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const togglePermission = (permissionId) => {
    setFormData((prev) => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.includes(permissionId)
        ? prev.selectedPermissions.filter((p) => p !== permissionId)
        : [...prev.selectedPermissions, permissionId],
    }));
  };

  const toggleModulePermissions = (moduleKey) => {
    const modulePermissions = permissions[moduleKey].permissions.map((p) => p.id);
    const allSelected = modulePermissions.every((p) => formData.selectedPermissions.includes(p));

    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        selectedPermissions: prev.selectedPermissions.filter((p) => !modulePermissions.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedPermissions: [...new Set([...prev.selectedPermissions, ...modulePermissions])],
      }));
    }
  };

  const getRoleBadge = (role) => {
    if (role.is_super_admin) {
      return (
        <span className="px-2 py-1 text-xs rounded-full font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Super Admin
        </span>
      );
    }
    if (role.is_default) {
      return (
        <span className="px-2 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-800">
          Default Role
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
        Custom Role
      </span>
    );
  };

  // ── Permissions matrix — shared between create and edit dialogs ────────────
  const PermissionsMatrix = () => (
    <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
      {Object.keys(permissions).map((moduleKey) => {
        const module = permissions[moduleKey];
        const modulePermissions = module.permissions.map((p) => p.id);
        const allSelected = modulePermissions.every((p) => formData.selectedPermissions.includes(p));
        const someSelected = modulePermissions.some((p) => formData.selectedPermissions.includes(p));

        return (
          <div key={moduleKey} className="mb-4 bg-white rounded-lg p-3 border">
            <div className="flex items-center mb-2 cursor-pointer" onClick={() => toggleModulePermissions(moduleKey)}>
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-600 mr-2" />
              ) : someSelected ? (
                <Square className="w-5 h-5 text-blue-400 mr-2" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 mr-2" />
              )}
              <span className="font-medium text-gray-800">{module.display_name}</span>
            </div>
            <div className="ml-7 space-y-1">
              {module.permissions.map((perm) => (
                <label key={perm.id} className="flex items-center cursor-pointer hover:bg-[#f0f7ff] p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formData.selectedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="mr-2"
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

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Create custom roles and assign granular permissions</p>
        </div>
        <Button
          onClick={() => {
            setFormData({ name: '', display_name: '', selectedPermissions: [] });
            setShowCreateDialog(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Custom Role
        </Button>
      </div>

      {/* Roles Table */}
      <DataCard>
        {loading ? (
          <div className="p-8 text-center">
            <InlineLoader text="Loading roles..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions Count</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-[#f0f7ff]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#4682B4]">{role.display_name}</div>
                      <div className="text-xs text-gray-500">{role.name}</div>
                    </td>
                    <td className="px-4 py-3">{getRoleBadge(role)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {role.permissions.includes('*') || role.is_super_admin ? (
                        <span className="text-purple-600 font-medium">All Permissions</span>
                      ) : (
                        `${role.permissions.length} permissions`
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {!role.is_default ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedRole(role);
                                setFormData({
                                  name: role.name,
                                  display_name: role.display_name,
                                  selectedPermissions: role.permissions,
                                });
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteRole(role.id, role.display_name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-6 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="e.g., store_manager"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase, use underscores for spaces</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="e.g., Store Manager"
                  required
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Permissions *</h3>
              <PermissionsMatrix />
              <p className="text-xs text-gray-500 mt-2">
                Selected: {formData.selectedPermissions.length} permissions
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit">Create Role</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditRole} className="space-y-6 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Permissions *</h3>
              <PermissionsMatrix />
              <p className="text-xs text-gray-500 mt-2">
                Selected: {formData.selectedPermissions.length} permissions
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit">Update Role</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, roleId: null, roleName: '', loading: false })}
        onConfirm={confirmDeleteRole}
        itemName={deleteDialog.roleName ? `role "${deleteDialog.roleName}"` : 'this role'}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}
