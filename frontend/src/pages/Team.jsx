/**
 * Team — merged Members + Roles page (design-system compliant)
 *
 * Two Shadcn Tabs:
 *   Members  — user list with invite / edit / deactivate / activate
 *   Roles    — roles list with permissions matrix
 *
 * Replaces the separate /users and /roles pages.
 * Design system: px-8 py-6 · h-10 rows · hover:bg-brand-tint · font-medium headers
 */

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import {
  Plus, Edit, XCircle, CheckCircle, Key, Shield,
  CheckSquare, Square, Trash2, AlertCircle, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InlineLoader, ConfirmDialog, DeleteConfirmDialog, SearchInput, PaginationBar } from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import usePagination from '@/hooks/usePagination';

// ── Role badge helper (muted colors per design system) ───────────────────────
function RoleBadge({ role }) {
  const map = {
    admin:           { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: 'Admin' },
    manager:         { cls: 'bg-blue-50 text-blue-700 border border-blue-200',       label: 'Manager' },
    cashier:         { cls: 'bg-green-50 text-green-700 border border-green-200',    label: 'Cashier' },
    inventory_staff: { cls: 'bg-amber-50 text-amber-700 border border-amber-200',    label: 'Inventory Staff' },
  };
  const { cls, label } = map[role] ?? { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: role };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

// ── Access denied guard ───────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex-1 flex items-center justify-center py-32">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-gray-900 mb-1">Access Denied</h2>
        <p className="text-sm text-gray-500">You do not have permission to access this page.</p>
      </div>
    </div>
  );
}

// ── Form input classes ────────────────────────────────────────────────────────
const inputCls =
  'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-gray-400';

// ─────────────────────────────────────────────────────────────────────────────
export default function Team() {
  const { user: currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('members');

  if (currentUser?.role !== 'admin') return <AccessDenied />;

  return (
    <div className="px-8 py-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage team members and their roles</p>
        </div>
        {/* Primary CTA is rendered inside each tab panel to stay contextual */}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="members" forceMount className={activeTab !== 'members' ? 'hidden' : ''}>
          <MembersTab currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="roles" forceMount className={activeTab !== 'roles' ? 'hidden' : ''}>
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBERS TAB
// ─────────────────────────────────────────────────────────────────────────────
function MembersTab({ currentUser }) {
  const [users, setUsers]                       = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [availableRoles, setAvailableRoles]     = useState([]);

  const [showAddDialog, setShowAddDialog]           = useState(false);
  const [showEditDialog, setShowEditDialog]         = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser]             = useState(null);
  const [deactivateDialog, setDeactivateDialog]     = useState({ open: false, userId: null, loading: false });

  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: '' });
  const [passwordData, setPasswordData] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });

  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedSearch                 = useDebounce(searchQuery, 300);
  const pg                              = usePagination({ pageSize: 15 });

  useEffect(() => { fetchUsers(); fetchRoles(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get(apiUrl.users());
      setUsers(res.data);
    } catch { toast.error('Failed to load users'); }
    finally  { setLoading(false); }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get(apiUrl.roles());
      setAvailableRoles(res.data);
    } catch { /* silent */ }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post(apiUrl.users(), formData);
      toast.success('User created successfully');
      setShowAddDialog(false);
      setFormData({ name: '', email: '', password: '', role: '' });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create user'); }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      await api.put(apiUrl.user(selectedUser.id), {
        name: formData.name, email: formData.email, role: formData.role,
      });
      toast.success('User updated successfully');
      setShowEditDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update user'); }
  };

  const handleDeactivate = (userId) => setDeactivateDialog({ open: true, userId, loading: false });

  const confirmDeactivate = async () => {
    const { userId } = deactivateDialog;
    if (!userId) return;
    setDeactivateDialog((p) => ({ ...p, loading: true }));
    try {
      await api.delete(apiUrl.user(userId));
      toast.success('User deactivated');
      setDeactivateDialog({ open: false, userId: null, loading: false });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate user');
      setDeactivateDialog((p) => ({ ...p, loading: false }));
    }
  };

  const handleActivate = async (userId) => {
    try {
      await api.put(apiUrl.user(userId), { is_active: true });
      toast.success('User activated');
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to activate user'); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match'); return;
    }
    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    try {
      await api.put(apiUrl.changePassword(), {
        current_password: passwordData.current_password,
        new_password:     passwordData.new_password,
      });
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password'); }
  };

  const filteredUsers = users.filter((u) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  useEffect(() => {
    pg.resetPage();
    pg.setTotal(filteredUsers.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, users.length]);

  const pageUsers = pg.slice(filteredUsers);

  return (
    <>
      {/* Sub-header: search + actions */}
      <div className="flex items-center justify-between mb-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search members..."
          className="w-60"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasswordDialog(true)}
            className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Key className="w-4 h-4" />
            Change Password
          </button>
          <button
            onClick={() => { setFormData({ name: '', email: '', password: '', role: '' }); setShowAddDialog(true); }}
            className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <InlineLoader text="Loading members..." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900">No members found</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {debouncedSearch ? 'Try adjusting your search' : 'Invite your first team member'}
                        </p>
                      </td>
                    </tr>
                  ) : pageUsers.map((u) => (
                    <tr key={u.id} className="group h-10 border-b border-gray-100 last:border-0 hover:bg-brand-tint">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{u.email}</td>
                      <td className="px-4 py-2.5"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-2.5">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setFormData({ name: u.name, email: u.email, role: u.role, password: '' });
                              setShowEditDialog(true);
                            }}
                            className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {u.id !== currentUser.id && (
                            u.is_active ? (
                              <button
                                onClick={() => handleDeactivate(u.id)}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Deactivate"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(u.id)}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                title="Activate"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar {...pg} />
          </>
        )}
      </div>

      {/* ── Add Member Dialog ─────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
              <input type="password" value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={inputCls} required minLength={6} />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
              <select value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={inputCls} required>
                <option value="">Select a role…</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.name}>{r.display_name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowAddDialog(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors">
                Create Member
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Member Dialog ────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
              <select value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={inputCls} required>
                <option value="">Select a role…</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.name}>{r.display_name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowEditDialog(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors">
                Update Member
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ────────────────────────────────────── */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change My Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current Password *</label>
              <input type="password" value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Password *</label>
              <input type="password" value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                className={inputCls} required minLength={6} />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password *</label>
              <input type="password" value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                className={inputCls} required minLength={6} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowPasswordDialog(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors">
                Change Password
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Confirm ────────────────────────────────────────── */}
      <ConfirmDialog
        open={deactivateDialog.open}
        onClose={() => setDeactivateDialog({ open: false, userId: null, loading: false })}
        onConfirm={confirmDeactivate}
        title="Deactivate Member?"
        description="They will no longer be able to sign in to the system."
        confirmLabel="Deactivate"
        isDestructive
        isLoading={deactivateDialog.loading}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES TAB
// ─────────────────────────────────────────────────────────────────────────────
function RolesTab() {
  const [roles, setRoles]           = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading]       = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog]     = useState(false);
  const [selectedRole, setSelectedRole]         = useState(null);
  const [deleteDialog, setDeleteDialog]         = useState({
    open: false, roleId: null, roleName: '', loading: false,
  });

  const [formData, setFormData] = useState({
    name: '', display_name: '', selectedPermissions: [],
  });

  useEffect(() => { fetchRoles(); fetchPermissions(); }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.get(apiUrl.roles());
      setRoles(res.data);
    } catch { toast.error('Failed to load roles'); }
    finally  { setLoading(false); }
  };

  const fetchPermissions = async () => {
    try {
      const res = await api.get(apiUrl.permissions());
      setPermissions(res.data);
    } catch { toast.error('Failed to load permissions'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (formData.selectedPermissions.length === 0) {
      toast.error('Select at least one permission'); return;
    }
    try {
      await api.post(apiUrl.roles(), {
        name:        formData.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: formData.display_name,
        permissions:  formData.selectedPermissions,
      });
      toast.success('Role created successfully');
      setShowCreateDialog(false);
      setFormData({ name: '', display_name: '', selectedPermissions: [] });
      fetchRoles();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create role'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (formData.selectedPermissions.length === 0) {
      toast.error('Select at least one permission'); return;
    }
    try {
      await api.put(apiUrl.role(selectedRole.id), {
        display_name: formData.display_name,
        permissions:  formData.selectedPermissions,
      });
      toast.success('Role updated successfully');
      setShowEditDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update role'); }
  };

  const handleDeleteClick = (roleId, roleName) =>
    setDeleteDialog({ open: true, roleId, roleName, loading: false });

  const confirmDelete = async () => {
    const { roleId } = deleteDialog;
    if (!roleId) return;
    setDeleteDialog((p) => ({ ...p, loading: true }));
    try {
      await api.delete(apiUrl.role(roleId));
      toast.success('Role deleted');
      setDeleteDialog({ open: false, roleId: null, roleName: '', loading: false });
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete role');
      setDeleteDialog((p) => ({ ...p, loading: false }));
    }
  };

  const togglePermission = (permId) => {
    setFormData((p) => ({
      ...p,
      selectedPermissions: p.selectedPermissions.includes(permId)
        ? p.selectedPermissions.filter((x) => x !== permId)
        : [...p.selectedPermissions, permId],
    }));
  };

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

  const RoleTypeBadge = ({ role }) => {
    if (role.is_super_admin)
      return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200"><Shield className="w-3 h-3" />Super Admin</span>;
    if (role.is_default)
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Default</span>;
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Custom</span>;
  };

  // Shared permissions matrix component
  const PermissionsMatrix = () => (
    <div className="border border-gray-200 rounded-lg p-3 max-h-80 overflow-y-auto bg-gray-50 space-y-2">
      {Object.keys(permissions).map((moduleKey) => {
        const mod = permissions[moduleKey];
        const ids = mod.permissions.map((p) => p.id);
        const allOn  = ids.every((id) => formData.selectedPermissions.includes(id));
        const someOn = ids.some((id)  => formData.selectedPermissions.includes(id));
        return (
          <div key={moduleKey} className="bg-white rounded-lg p-3 border border-gray-100">
            <button
              type="button"
              onClick={() => toggleModule(moduleKey)}
              className="flex items-center gap-2 w-full mb-2"
            >
              {allOn ? (
                <CheckSquare className="w-4 h-4 text-brand flex-shrink-0" />
              ) : someOn ? (
                <Square className="w-4 h-4 text-brand/50 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
              <span className="text-sm font-medium text-gray-800">{mod.display_name}</span>
            </button>
            <div className="ml-6 space-y-1">
              {mod.permissions.map((perm) => (
                <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={formData.selectedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
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
  );

  return (
    <>
      {/* Sub-header */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => { setFormData({ name: '', display_name: '', selectedPermissions: [] }); setShowCreateDialog(true); }}
          className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <InlineLoader text="Loading roles..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900">No roles found</p>
                      <p className="text-sm text-gray-500 mt-1">Create your first custom role</p>
                    </td>
                  </tr>
                ) : roles.map((role) => (
                  <tr key={role.id} className="group h-10 border-b border-gray-100 last:border-0 hover:bg-brand-tint">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-gray-900">{role.display_name}</div>
                      <div className="text-xs text-gray-500 font-mono">{role.name}</div>
                    </td>
                    <td className="px-4 py-2.5"><RoleTypeBadge role={role} /></td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {role.permissions.includes('*') || role.is_super_admin ? (
                        <span className="text-purple-700 font-medium">All permissions</span>
                      ) : (
                        `${role.permissions.length} permissions`
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {!role.is_default ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRole(role);
                                setFormData({ name: role.name, display_name: role.display_name, selectedPermissions: role.permissions });
                                setShowEditDialog(true);
                              }}
                              className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              title="Edit role"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(role.id, role.display_name)}
                              className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete role"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic pr-2">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Role Dialog ────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role Key *</label>
                <input type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputCls} placeholder="e.g., store_manager" required />
                <p className="text-xs text-gray-500 mt-1">Lowercase, underscores only</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
                <input type="text" value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className={inputCls} placeholder="e.g., Store Manager" required />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Permissions * <span className="text-gray-400 font-normal">({formData.selectedPermissions.length} selected)</span>
              </p>
              <PermissionsMatrix />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowCreateDialog(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors">
                Create Role
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ──────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
              <input type="text" value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Permissions * <span className="text-gray-400 font-normal">({formData.selectedPermissions.length} selected)</span>
              </p>
              <PermissionsMatrix />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowEditDialog(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors">
                Update Role
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirm ───────────────────────────────────────── */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, roleId: null, roleName: '', loading: false })}
        onConfirm={confirmDelete}
        itemName={deleteDialog.roleName ? `role "${deleteDialog.roleName}"` : 'this role'}
        isLoading={deleteDialog.loading}
      />
    </>
  );
}
