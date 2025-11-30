/**
 * EditUserModal Component
 * Phase 5, Task 5.1 - User Service Status Controls
 *
 * Modal for editing user details with:
 * - Details tab: Avatar, user info, job title, system role, password change
 * - Permissions tab: Organization permissions management per user
 * - PEMS email change warning
 * - Auth provider lock for PEMS users
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Save, User, Shield, Building2, RefreshCw, Trash2, Upload, Briefcase, Lock, CheckCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { ProviderBadge } from '../StatusBadge';
import { CapabilityEditorModal } from './CapabilityEditorModal';
import { RevokeAccessDialog } from './RevokeAccessDialog';

interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  jobTitle?: string;
  authProvider: 'local' | 'pems';
  externalId?: string;
  role: string;
  organizations: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  assignmentSource: 'local' | 'pems_sync';
  externalRoleId?: string;
  isCustom: boolean;
  organization: {
    id: string;
    code: string;
    name: string;
    description?: string;
    isExternal: boolean;
    externalId?: string;
    serviceStatus: string;
  };
  permissions: Record<string, boolean>;
  roleTemplate: Record<string, boolean>;
  enabledCapabilitiesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

type TabType = 'details' | 'permissions';

export function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Details tab state
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role,
    avatarUrl: user.avatarUrl || '',
    jobTitle: user.jobTitle || '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissions tab state
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [selectedUserOrg, setSelectedUserOrg] = useState<UserOrganization | null>(null);
  const [revokeUserOrgId, setRevokeUserOrgId] = useState<string | null>(null);

  const emailChanged = formData.email !== (user.email || '');
  const isPemsUser = user.authProvider === 'pems';
  const showPemsWarning = isPemsUser && emailChanged;

  // Load user organizations when switching to permissions tab
  useEffect(() => {
    if (activeTab === 'permissions' && userOrgs.length === 0) {
      loadUserOrganizations();
    }
  }, [activeTab]);

  const loadUserOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      setPermError(null);
      const response = await apiClient.getUserOrganizations(user.id);
      // Cast to local interface (backend returns more fields than apiTypes defines)
      setUserOrgs((response.userOrganizations as unknown as UserOrganization[]) || []);
    } catch (err: any) {
      const message = err.message || 'Failed to load user organizations';
      setPermError(message);
      console.error('Failed to load user organizations:', err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (showPemsWarning && !confirmOverride) {
      setError('Please confirm you understand the email change is temporary');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSaving(true);
      const updateData: Record<string, unknown> = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role as 'admin' | 'user' | 'viewer',
        avatarUrl: formData.avatarUrl || undefined,
        jobTitle: formData.jobTitle || undefined,
      };

      if (password) {
        updateData.password = password;
      }

      await apiClient.updateUser(user.id, updateData);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('avatarUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRoleChange = async (userOrg: UserOrganization, newRole: string) => {
    try {
      const adminOrgId = user.organizations[0]?.id || '';
      await apiClient.updateUserOrgRole(userOrg.id, newRole, adminOrgId);
      await loadUserOrganizations();
    } catch (err: any) {
      alert(`Failed to change role: ${err.message}`);
    }
  };

  const handleSaveCapabilities = async (capabilities: Record<string, boolean>) => {
    if (!selectedUserOrg) return;

    try {
      const adminOrgId = user.organizations[0]?.id || '';
      await apiClient.updateUserOrgCapabilities(
        selectedUserOrg.id,
        capabilities,
        adminOrgId
      );
      setSelectedUserOrg(null);
      await loadUserOrganizations();
    } catch (err: any) {
      alert(`Failed to save capabilities: ${err.message}`);
    }
  };

  const handleRevokeAccess = async (reason: string) => {
    if (!revokeUserOrgId) return;

    try {
      const adminOrgId = user.organizations[0]?.id || '';
      await apiClient.revokeUserOrganization(revokeUserOrgId, adminOrgId, reason);
      setRevokeUserOrgId(null);
      await loadUserOrganizations();
    } catch (err: any) {
      alert(`Failed to revoke access: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">Edit User</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-400">{user.username}</span>
                <ProviderBadge provider={user.authProvider} size="sm" />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Details
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Permissions
            {user.organizations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-600 rounded">
                {user.organizations.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' ? (
            /* Details Tab - Merged Details + Profile */
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Error Banner */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* PEMS User Info */}
              {isPemsUser && (
                <div className="bg-blue-500/20 border border-blue-500/40 text-blue-300 px-4 py-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">PEMS User Notice</p>
                      <p>
                        This user is synced from PEMS. Changes to email, username, or role
                        may be overwritten on the next PEMS sync.
                      </p>
                      {user.externalId && (
                        <p className="mt-2 text-xs text-blue-400">
                          PEMS ID: {user.externalId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Avatar Section */}
              <div className="flex items-center gap-6 pb-4 border-b border-slate-700">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600">
                    {formData.avatarUrl ? (
                      <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-1.5 rounded-full cursor-pointer hover:bg-blue-600 transition-colors border-2 border-slate-800">
                    <Upload className="w-3 h-3" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Avatar URL</label>
                  <input
                    type="url"
                    value={formData.avatarUrl}
                    onChange={(e) => handleChange('avatarUrl', e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500">Upload an image or paste a URL</p>
                </div>
              </div>

              {/* Username & Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Username
                    {isPemsUser && (
                      <span className="ml-2 text-xs text-slate-500">(Read-only)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    disabled={isPemsUser}
                    className={`w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500 ${
                      isPemsUser ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="user@example.com"
                  />
                </div>
              </div>

              {/* PEMS Email Warning */}
              {showPemsWarning && (
                <div className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-4 py-3 rounded-lg">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Warning: PEMS User Email Change</p>
                      <p>
                        Changing the email for a PEMS user may break synchronization.
                        Your local change will be overwritten on the next PEMS sync.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmOverride}
                      onChange={(e) => setConfirmOverride(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-600 rounded focus:ring-2 focus:ring-yellow-500"
                    />
                    <span>I understand this change is temporary and will be overwritten</span>
                  </label>
                </div>
              )}

              {/* Name Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="Last name"
                  />
                </div>
              </div>

              {/* Job Title & Role Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Briefcase className="inline w-4 h-4 mr-1" />
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => handleChange('jobTitle', e.target.value)}
                    placeholder="e.g., Project Manager"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Password Change Section */}
              {!isPemsUser && (
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                  <h4 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Change Password
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Leave blank to keep current password</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="submit"
                  disabled={saving || (showPemsWarning && !confirmOverride) || (password.length > 0 && password !== confirmPassword)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
                    saving || (showPemsWarning && !confirmOverride) || (password.length > 0 && password !== confirmPassword)
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* Permissions Tab */
            <div className="p-6 space-y-6">
              {/* Header with Refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-purple-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">Organization Permissions</h3>
                    <p className="text-sm text-slate-400">
                      Configure access and capabilities per organization
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadUserOrganizations}
                  disabled={loadingOrgs}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrgs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Error Banner */}
              {permError && (
                <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{permError}</span>
                </div>
              )}

              {loadingOrgs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : userOrgs.length === 0 && !permError ? (
                <div className="bg-slate-700/50 rounded-lg border border-slate-600 p-8 text-center">
                  <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400">No organization assignments found</p>
                  <p className="text-sm text-slate-500 mt-1">
                    This user is not assigned to any organizations yet.
                  </p>
                  <button
                    onClick={loadUserOrganizations}
                    className="mt-4 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-sm transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : userOrgs.length === 0 && permError ? (
                <div className="bg-slate-700/50 rounded-lg border border-red-500/30 p-8 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-red-400">Failed to load permissions</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Check your network connection or try again.
                  </p>
                  <button
                    onClick={loadUserOrganizations}
                    className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center gap-4 text-sm text-slate-300">
                      <span>
                        <strong className="text-blue-400">{userOrgs.length}</strong> Organizations
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>
                        <strong className="text-orange-400">{userOrgs.filter(uo => uo.isCustom).length}</strong> Custom
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>
                        <strong className="text-purple-400">{userOrgs.filter(uo => uo.assignmentSource === 'pems_sync').length}</strong> PEMS Synced
                      </span>
                    </div>
                  </div>

                  {/* Organizations List */}
                  <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-800 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                            Organization
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                            Source
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                            Permissions
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {userOrgs.map((userOrg) => (
                          <tr key={userOrg.id} className="hover:bg-slate-800/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-semibold">
                                  {userOrg.organization.code.charAt(0)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-200">
                                      {userOrg.organization.code}
                                    </span>
                                    {userOrg.organization.isExternal && (
                                      <ProviderBadge provider="pems" size="sm" />
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500">
                                    {userOrg.organization.name}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={userOrg.role}
                                onChange={(e) => handleRoleChange(userOrg, e.target.value)}
                                disabled={userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom}
                                className={`px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm focus:outline-none focus:border-blue-500 ${
                                  userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                }`}
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                                <option value="admin">Admin</option>
                                <option value="beo">BEO User</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-xs ${
                                  userOrg.assignmentSource === 'pems_sync' ? 'text-blue-400' : 'text-slate-400'
                                }`}>
                                  {userOrg.assignmentSource === 'pems_sync' ? 'PEMS Sync' : 'Local'}
                                </span>
                                {userOrg.isCustom && (
                                  <span className="text-xs text-orange-400">Custom</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedUserOrg(userOrg)}
                                className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Edit ({userOrg.enabledCapabilitiesCount} active)
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setRevokeUserOrgId(userOrg.id)}
                                disabled={userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom}
                                className={`p-1.5 rounded transition-colors ${
                                  userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom
                                    ? 'text-slate-600 cursor-not-allowed'
                                    : 'hover:bg-red-500/20 text-red-400'
                                }`}
                                title={
                                  userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom
                                    ? 'Cannot revoke PEMS assignments'
                                    : 'Revoke Access'
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Permission Legend */}
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-700">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Permission Categories</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-400">
                      <div><strong>Read</strong> - View PFA records</div>
                      <div><strong>EditForecast</strong> - Modify forecasts</div>
                      <div><strong>EditActuals</strong> - Modify actuals</div>
                      <div><strong>Delete</strong> - Soft delete records</div>
                      <div><strong>Import</strong> - CSV import</div>
                      <div><strong>Export</strong> - Excel export</div>
                      <div><strong>RefreshData</strong> - PEMS sync</div>
                      <div><strong>ViewFinancials</strong> - Cost data</div>
                      <div><strong>SaveDraft</strong> - Save drafts</div>
                      <div><strong>Sync</strong> - Push to PEMS</div>
                      <div><strong>ManageUsers</strong> - User admin</div>
                      <div><strong>ManageSettings</strong> - System config</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Capability Editor Modal */}
      {selectedUserOrg && (
        <CapabilityEditorModal
          userOrg={selectedUserOrg}
          onClose={() => setSelectedUserOrg(null)}
          onSave={handleSaveCapabilities}
        />
      )}

      {/* Revoke Access Dialog */}
      {revokeUserOrgId && (
        <RevokeAccessDialog
          userOrgId={revokeUserOrgId}
          onConfirm={handleRevokeAccess}
          onCancel={() => setRevokeUserOrgId(null)}
        />
      )}
    </div>
  );
}
