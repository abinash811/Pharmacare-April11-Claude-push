import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import axios from 'axios';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Key, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Dialog = ({ open, onClose, title, children }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function Users() {
  const { user: currentUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier'
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load users');
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
      await axios.post(`${API}/users`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User created successfully');
      setShowAddDialog(false);
      setFormData({ name: '', email: '', password: '', role: 'cashier' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
      await axios.put(`${API}/users/${selectedUser.id}`, {
        name: formData.name,
        email: formData.email,
        role: formData.role
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User updated successfully');
      setShowEditDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deactivated successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const handleActivateUser = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API}/users/${userId}`, { is_active: true }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User activated successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to activate user');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API}/users/me/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-blue-100 text-blue-800',
      cashier: 'bg-green-100 text-green-800',
      inventory_staff: 'bg-orange-100 text-orange-800'
    };
    
    const labels = {
      admin: 'Admin',
      manager: 'Manager',
      cashier: 'Cashier',
      inventory_staff: 'Inventory Staff'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[role] || 'bg-gray-100 text-gray-800'}`}>
        {labels[role] || role}
      </span>
    );
  };

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
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users and their access permissions</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowPasswordDialog(true)}>
            <Key className="w-4 h-4 mr-2 inline" />
            Change My Password
          </Button>
          <Button onClick={() => {
            setFormData({ name: '', email: '', password: '', role: 'cashier' });
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                    <td className="px-6 py-4 text-center">
                      {user.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedUser(user);
                            setFormData({ name: user.name, email: user.email, role: user.role, password: '' });
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {user.id !== currentUser.id && (
                          user.is_active ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeactivateUser(user.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleActivateUser(user.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )
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

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} title="Add New User">
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            >
              <option value="cashier">Cashier</option>
              <option value="inventory_staff">Inventory Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button type="submit">Create User</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} title="Edit User">
        <form onSubmit={handleEditUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            >
              <option value="cashier">Cashier</option>
              <option value="inventory_staff">Inventory Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button type="submit">Update User</Button>
          </div>
        </form>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
            <input
              type="password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
            <input
              type="password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
            <input
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
              minLength={6}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button type="submit">Change Password</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
