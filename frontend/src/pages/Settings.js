import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Settings() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8" data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-600 mt-1">Manage application settings</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <Card data-testid="profile-card">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-800" data-testid="profile-name">{user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-800" data-testid="profile-email">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <p className="font-medium text-gray-800 capitalize" data-testid="profile-role">{user?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Management - Admin Only */}
        {user?.role === 'admin' && (
          <Card data-testid="user-management-card">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage system users</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="users-table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50" data-testid={`user-row-${u.id}`}>
                        <td className="px-6 py-4 font-medium text-gray-800">{u.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">{u.role}</td>
                        <td className="px-6 py-4">
                          {u.id !== user.id && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id)}
                              data-testid={`delete-user-${u.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
