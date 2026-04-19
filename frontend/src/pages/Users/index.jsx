import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { Plus, Key, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SearchInput, PageHeader, AppButton } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import usePagination from '@/hooks/usePagination';
import UsersTable from './components/UsersTable';
import UserDialogs from './components/UserDialogs';

export default function Users() {
  const { user: currentUser } = useContext(AuthContext);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAddDialog, setShowAddDialog]         = useState(false);
  const [showEditDialog, setShowEditDialog]       = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser]           = useState(null);
  const [deactivateDialog, setDeactivateDialog]   = useState({ open: false, userId: null, loading: false });
  const [formData, setFormData]     = useState({ name: '', email: '', password: '', role: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [availableRoles, setAvailableRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const pg = usePagination({ pageSize: 15 });

  useEffect(() => { fetchUsers(); fetchRoles(); }, []);

  const fetchRoles = async () => {
    try { const res = await api.get(apiUrl.roles()); setAvailableRoles(res.data); }
    catch { /* silent */ }
  };

  const fetchUsers = async () => {
    try { const res = await api.get(apiUrl.users()); setUsers(res.data); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
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
      await api.put(apiUrl.user(selectedUser.id), { name: formData.name, email: formData.email, role: formData.role });
      toast.success('User updated successfully');
      setShowEditDialog(false); setSelectedUser(null); fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update user'); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) { toast.error('Passwords do not match'); return; }
    if (passwordData.new_password.length < 6) { toast.error('Minimum 6 characters'); return; }
    try {
      await api.put(apiUrl.changePassword(), { current_password: passwordData.current_password, new_password: passwordData.new_password });
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password'); }
  };

  const confirmDeactivate = async () => {
    setDeactivateDialog((p) => ({ ...p, loading: true }));
    try {
      await api.delete(apiUrl.user(deactivateDialog.userId));
      toast.success('User deactivated');
      setDeactivateDialog({ open: false, userId: null, loading: false });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate user');
      setDeactivateDialog((p) => ({ ...p, loading: false }));
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pg.resetPage(); pg.setTotal(filteredUsers.length); }, [debouncedSearch, users.length]);

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
        title="User Management"
        actions={
          <div className="flex gap-2">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search users..." className="w-56" />
            <AppButton variant="outline" icon={<Key className="h-4 w-4" strokeWidth={1.5} />} onClick={() => setShowPasswordDialog(true)}>Change My Password</AppButton>
            <AppButton icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={() => { setFormData({ name: '', email: '', password: '', role: '' }); setShowAddDialog(true); }}>Add User</AppButton>
          </div>
        }
      />

      <UsersTable
        users={pg.slice(filteredUsers)}
        loading={loading}
        pagination={pg}
        currentUser={currentUser}
        onEdit={(u) => { setSelectedUser(u); setFormData({ name: u.name, email: u.email, role: u.role, password: '' }); setShowEditDialog(true); }}
        onDeactivate={(id) => setDeactivateDialog({ open: true, userId: id, loading: false })}
        onActivate={async (id) => {
          try { await api.put(apiUrl.user(id), { is_active: true }); toast.success('User activated'); fetchUsers(); }
          catch (err) { toast.error(err.response?.data?.detail || 'Failed to activate user'); }
        }}
      />

      <UserDialogs
        showAddDialog={showAddDialog} onCloseAdd={() => setShowAddDialog(false)} onSubmitAdd={handleAddUser}
        showEditDialog={showEditDialog} onCloseEdit={() => setShowEditDialog(false)} onSubmitEdit={handleEditUser}
        showPasswordDialog={showPasswordDialog} onClosePassword={() => setShowPasswordDialog(false)} onSubmitPassword={handleChangePassword}
        formData={formData} onFormChange={setFormData}
        passwordData={passwordData} onPasswordChange={setPasswordData}
        availableRoles={availableRoles}
        deactivateDialog={deactivateDialog}
        onCloseDeactivate={() => setDeactivateDialog({ open: false, userId: null, loading: false })}
        onConfirmDeactivate={confirmDeactivate}
      />
    </div>
  );
}
