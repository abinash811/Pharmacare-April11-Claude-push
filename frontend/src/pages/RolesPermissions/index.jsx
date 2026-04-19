import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, AppButton } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import RolesTable from './components/RolesTable';
import RoleDialogs from './components/RoleDialogs';

export default function RolesPermissions() {
  const { user: currentUser } = useContext(AuthContext);
  const [roles, setRoles]         = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading]     = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog]     = useState(false);
  const [selectedRole, setSelectedRole]         = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, roleId: null, roleName: '', loading: false });
  const [formData, setFormData] = useState({ name: '', display_name: '', selectedPermissions: [] });

  useEffect(() => { fetchRoles(); fetchPermissions(); }, []);

  const fetchRoles = async () => {
    try { const res = await api.get(apiUrl.roles()); setRoles(res.data); }
    catch { toast.error('Failed to load roles'); }
    finally { setLoading(false); }
  };

  const fetchPermissions = async () => {
    try { const res = await api.get(apiUrl.permissions()); setPermissions(res.data); }
    catch { toast.error('Failed to load permissions'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (formData.selectedPermissions.length === 0) { toast.error('Select at least one permission'); return; }
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
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create role'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (formData.selectedPermissions.length === 0) { toast.error('Select at least one permission'); return; }
    try {
      await api.put(apiUrl.role(selectedRole.id), { display_name: formData.display_name, permissions: formData.selectedPermissions });
      toast.success('Role updated successfully');
      setShowEditDialog(false); setSelectedRole(null); fetchRoles();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update role'); }
  };

  const confirmDelete = async () => {
    setDeleteDialog((p) => ({ ...p, loading: true }));
    try {
      await api.delete(apiUrl.role(deleteDialog.roleId));
      toast.success('Role deleted');
      setDeleteDialog({ open: false, roleId: null, roleName: '', loading: false });
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete role');
      setDeleteDialog((p) => ({ ...p, loading: false }));
    }
  };

  const togglePermission = (permId) => setFormData((p) => ({
    ...p,
    selectedPermissions: p.selectedPermissions.includes(permId)
      ? p.selectedPermissions.filter((x) => x !== permId)
      : [...p.selectedPermissions, permId],
  }));

  const toggleModule = (moduleKey) => {
    const ids = permissions[moduleKey].permissions.map((p) => p.id);
    const allOn = ids.every((id) => formData.selectedPermissions.includes(id));
    setFormData((p) => ({
      ...p,
      selectedPermissions: allOn
        ? p.selectedPermissions.filter((x) => !ids.includes(x))
        : [...new Set([...p.selectedPermissions, ...ids])],
    }));
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-900">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">
      <PageHeader
        title="Roles & Permissions"
        actions={
          <AppButton icon={<Plus className="h-4 w-4" strokeWidth={1.5} />}
            onClick={() => { setFormData({ name: '', display_name: '', selectedPermissions: [] }); setShowCreateDialog(true); }}>
            Create Role
          </AppButton>
        }
      />

      <RolesTable
        roles={roles}
        loading={loading}
        onEdit={(role) => {
          setSelectedRole(role);
          setFormData({ name: role.name, display_name: role.display_name, selectedPermissions: role.permissions });
          setShowEditDialog(true);
        }}
        onDelete={(roleId, roleName) => setDeleteDialog({ open: true, roleId, roleName, loading: false })}
      />

      <RoleDialogs
        permissions={permissions}
        showCreateDialog={showCreateDialog} onCloseCreate={() => setShowCreateDialog(false)} onSubmitCreate={handleCreate}
        showEditDialog={showEditDialog} onCloseEdit={() => setShowEditDialog(false)} onSubmitEdit={handleEdit}
        formData={formData} onFormChange={setFormData}
        onTogglePermission={togglePermission} onToggleModule={toggleModule}
        deleteDialog={deleteDialog}
        onCloseDelete={() => setDeleteDialog({ open: false, roleId: null, roleName: '', loading: false })}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}
