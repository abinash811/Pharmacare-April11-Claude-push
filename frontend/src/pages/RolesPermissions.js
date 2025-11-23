import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import axios from 'axios';
import { Plus, Edit, Trash2, Shield, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2'
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

const Dialog = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  
  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className={`bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4 my-8`}>
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function RolesPermissions() {
  const { user: currentUser } = useContext(AuthContext);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    selectedPermissions: []
  });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoles(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load roles');
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(response.data);
    } catch (error) {
      toast.error('Failed to load permissions');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    
    if (formData.selectedPermissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API}/roles`, {
        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: formData.display_name,
        permissions: formData.selectedPermissions
      }, {
        headers: { Authorization: `Bearer ${token}` }
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
    
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API}/roles/${selectedRole.id}`, {
        display_name: formData.display_name,
        permissions: formData.selectedPermissions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Role updated successfully');
      setShowEditDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) {
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
    }
  };

  const togglePermission = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.includes(permissionId)
        ? prev.selectedPermissions.filter(p => p !== permissionId)
        : [...prev.selectedPermissions, permissionId]
    }));
  };

  const toggleModulePermissions = (moduleKey) => {
    const modulePermissions = permissions[moduleKey].permissions.map(p => p.id);
    const allSelected = modulePermissions.every(p => formData.selectedPermissions.includes(p));
    
    if (allSelected) {
      // Deselect all module permissions
      setFormData(prev => ({
        ...prev,
        selectedPermissions: prev.selectedPermissions.filter(p => !modulePermissions.includes(p))
      }));
    } else {
      // Select all module permissions
      setFormData(prev => ({
        ...prev,
        selectedPermissions: [...new Set([...prev.selectedPermissions, ...modulePermissions])]
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
          <h1 className="text-3xl font-bold text-gray-800">Roles & Permissions</h1>
          <p className="text-gray-600 mt-1">Create custom roles and assign granular permissions</p>
        </div>
        <Button onClick={() => {
          setFormData({ name: '', display_name: '', selectedPermissions: [] });
          setShowCreateDialog(true);
        }}>
          <Plus className="w-4 h-4 mr-2 inline" />
          Create Custom Role
        </Button>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading roles...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{role.display_name}</div>
                      <div className="text-xs text-gray-500">{role.name}</div>
                    </td>
                    <td className="px-6 py-4">{getRoleBadge(role)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {role.permissions.includes('*') || role.is_super_admin ? (
                        <span className="text-purple-600 font-medium">All Permissions</span>
                      ) : (
                        `${role.permissions.length} permissions`
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {!role.is_default && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedRole(role);
                                setFormData({
                                  name: role.name,
                                  display_name: role.display_name,
                                  selectedPermissions: role.permissions
                                });
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteRole(role.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {role.is_default && (
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
      </div>

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title="Create Custom Role" size="xl">
        <form onSubmit={handleCreateRole} className="space-y-6">
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
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
              {Object.keys(permissions).map((moduleKey) => {
                const module = permissions[moduleKey];
                const modulePermissions = module.permissions.map(p => p.id);
                const allSelected = modulePermissions.every(p => formData.selectedPermissions.includes(p));
                const someSelected = modulePermissions.some(p => formData.selectedPermissions.includes(p));
                
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
                        <label key={perm.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
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
            <p className="text-xs text-gray-500 mt-2">
              Selected: {formData.selectedPermissions.length} permissions
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button type="submit">Create Role</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} title="Edit Role" size="xl">
        <form onSubmit={handleEditRole} className="space-y-6">
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
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
              {Object.keys(permissions).map((moduleKey) => {
                const module = permissions[moduleKey];
                const modulePermissions = module.permissions.map(p => p.id);
                const allSelected = modulePermissions.every(p => formData.selectedPermissions.includes(p));
                const someSelected = modulePermissions.some(p => formData.selectedPermissions.includes(p));
                
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
                        <label key={perm.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
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
            <p className="text-xs text-gray-500 mt-2">
              Selected: {formData.selectedPermissions.length} permissions
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button type="submit">Update Role</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
