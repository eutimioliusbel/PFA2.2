/**
 * UserManagement Component
 * Phase 5, Task 5.1 - User Service Status Controls
 *
 * Admin dashboard for managing users:
 * - View all users with status and provider info
 * - Suspend/Activate users
 * - Edit user details
 * - PEMS user indicators
 */

import { useState, useEffect } from 'react';
import {
  Users,
  Edit,
  Trash2,
  RefreshCw,
  Pause,
  Play,
  AlertCircle,
  Shield,
  X,
  Search,
  Plus,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import type { ApiUser } from '../../types';
import { StatusBadge, ProviderBadge } from '../StatusBadge';
import { EditUserModal } from './EditUserModal';
import { UserOrgPermissions } from './UserOrgPermissions';

type User = ApiUser;

// Reusable UserAvatar component with fallback to initials
function UserAvatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  const initials = user.firstName && user.lastName
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : user.username.charAt(0).toUpperCase();

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold overflow-hidden`}>
      {user.avatarUrl && !imgError ? (
        <img
          src={user.avatarUrl}
          alt={user.username}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

interface UserManagementProps {
  onStartImpersonation?: (userId: string) => Promise<void>;
  canImpersonate?: boolean;
}

export function UserManagement({ onStartImpersonation, canImpersonate = false }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.firstName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.lastName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers();
      setUsers(response.users);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId: string) => {
    try {
      await apiClient.suspendUser(userId, suspendReason);
      setShowSuspendDialog(null);
      setSuspendReason('');
      await loadUsers();
    } catch (err: any) {
      alert(`Failed to suspend user: ${err.message}`);
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      await apiClient.activateUser(userId);
      await loadUsers();
    } catch (err: any) {
      alert(`Failed to activate user: ${err.message}`);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.authProvider === 'pems') {
      alert('Cannot delete PEMS users. Suspend them instead.');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.deleteUser(user.id);
      await loadUsers();
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  const handleImpersonate = async (user: User) => {
    if (!onStartImpersonation) return;

    if (user.serviceStatus !== 'active') {
      alert('Cannot impersonate inactive users');
      return;
    }

    if (!confirm(`You are about to view the application as "${user.username}". Your actions will be logged. Continue?`)) {
      return;
    }

    try {
      setImpersonatingUserId(user.id);
      await onStartImpersonation(user.id);
    } catch (err: any) {
      alert(`Failed to start impersonation: ${err.message}`);
      setImpersonatingUserId(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Users</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage user accounts and permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New User
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Summary */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 text-slate-300">
          <Users className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">
            Total Users: <span className="text-blue-400">{users.length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Active: <span className="text-green-400">{users.filter(u => u.serviceStatus === 'active').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Suspended: <span className="text-yellow-400">{users.filter(u => u.serviceStatus === 'suspended').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            PEMS Users: <span className="text-blue-400">{users.filter(u => u.authProvider === 'pems').length}</span>
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Organizations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onDoubleClick={() => setSelectedUser(user)}
                  title="Double-click to edit"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">
                            {user.username}
                          </span>
                          <ProviderBadge provider={user.authProvider} size="sm" />
                        </div>
                        {user.firstName && (
                          <span className="text-sm text-slate-400">
                            {user.firstName} {user.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {user.email || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`${user.authProvider === 'pems' ? 'text-blue-400' : 'text-slate-400'}`}>
                      {user.authProvider.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={user.serviceStatus} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-300">
                      {user.organizations.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {user.organizations.slice(0, 2).map((org) => (
                            <span key={org.id} className="text-xs">
                              {org.code}
                            </span>
                          ))}
                          {user.organizations.length > 2 && (
                            <span className="text-xs text-slate-500">
                              +{user.organizations.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">No organizations</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {/* Suspend/Activate Button */}
                      {user.serviceStatus === 'active' ? (
                        <button
                          onClick={() => setShowSuspendDialog(user.id)}
                          className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
                          title="Suspend User"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(user.id)}
                          className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors"
                          title="Activate User"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      {/* View As Button (Impersonation) */}
                      {canImpersonate && onStartImpersonation && (
                        <button
                          onClick={() => handleImpersonate(user)}
                          disabled={user.serviceStatus !== 'active' || impersonatingUserId === user.id}
                          className={`p-2 rounded transition-colors ${
                            user.serviceStatus !== 'active'
                              ? 'text-slate-600 cursor-not-allowed'
                              : impersonatingUserId === user.id
                              ? 'bg-orange-500/30 text-orange-400 animate-pulse'
                              : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400'
                          }`}
                          title={
                            user.serviceStatus !== 'active'
                              ? 'Cannot impersonate inactive users'
                              : impersonatingUserId === user.id
                              ? 'Starting impersonation...'
                              : 'View As This User'
                          }
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Organization Permissions Button */}
                      <button
                        onClick={() => setPermissionsUserId(user.id)}
                        className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded transition-colors"
                        title="Manage Organization Permissions"
                      >
                        <Shield className="w-4 h-4" />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* Delete Button (disabled for PEMS users) */}
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={user.authProvider === 'pems'}
                        className={`p-2 rounded transition-colors ${
                          user.authProvider === 'pems'
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                        }`}
                        title={user.authProvider === 'pems' ? 'Cannot delete PEMS users' : 'Delete User'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    {searchQuery ? 'No users found matching your search.' : 'No users available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Dialog */}
      {showSuspendDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Suspend User</h3>
            <p className="text-sm text-slate-300 mb-4">
              Provide a reason for suspending this user (optional):
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g., Policy violation, temporary access revoked, etc."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleSuspend(showSuspendDialog)}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition-colors"
              >
                Suspend User
              </button>
              <button
                onClick={() => {
                  setShowSuspendDialog(null);
                  setSuspendReason('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={async () => {
            setSelectedUser(null);
            await loadUsers();
          }}
        />
      )}

      {/* User Organization Permissions Modal */}
      {permissionsUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-6xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-purple-500" />
                <h2 className="text-xl font-bold text-slate-100">
                  User Organization Permissions
                </h2>
              </div>
              <button
                onClick={() => setPermissionsUserId(null)}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <UserOrgPermissions
                userId={permissionsUserId}
                organizationId={users.find(u => u.id === permissionsUserId)?.organizations[0]?.id || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSave={async () => {
            setShowCreateModal(false);
            await loadUsers();
          }}
        />
      )}
    </div>
  );
}

// Simple Create User Modal Component
function CreateUserModal({ onClose, onSave }: { onClose: () => void; onSave: () => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'viewer'>('user');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiClient.createUser({
        username: username.trim(),
        email: email.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        password,
        role,
      });
      await onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900 rounded-t-lg">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-slate-100">Create New User</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Username <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Avatar URL</label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                ) : (
                  <span>{username ? username.charAt(0).toUpperCase() : '?'}</span>
                )}
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user' | 'viewer')}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="viewer">Viewer</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t border-slate-700 bg-slate-900 rounded-b-lg">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded font-medium transition-colors"
          >
            {saving ? 'Creating...' : 'Create User'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
