/**
 * UserOrgPermissions Component
 * Phase 5, Task 5.3 - User-Organization Permission Manager
 *
 * Manages granular permissions for user-organization assignments:
 * - View user's organization assignments
 * - Change roles per organization
 * - Configure custom capabilities
 * - Revoke access
 */

import { useState, useEffect } from 'react';
import {
  Building2,
  Settings,
  Trash2,
  RefreshCw,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { ProviderBadge } from '../StatusBadge';
import { CapabilityEditorModal } from './CapabilityEditorModal';
import { RevokeAccessDialog } from './RevokeAccessDialog';
import type { UserOrganization } from '../../types';

interface UserOrgPermissionsProps {
  userId: string;
  organizationId: string; // Current admin's org for permission check
}

export function UserOrgPermissions({ userId, organizationId }: UserOrgPermissionsProps) {
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserOrg, setSelectedUserOrg] = useState<UserOrganization | null>(null);
  const [revokeUserOrgId, setRevokeUserOrgId] = useState<string | null>(null);

  useEffect(() => {
    loadUserOrganizations();
  }, [userId]);

  const loadUserOrganizations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserOrganizations(userId);
      setUserOrgs(response.userOrganizations);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load user organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userOrg: UserOrganization, newRole: string) => {
    try {
      await apiClient.updateUserOrgRole(userOrg.id, newRole, organizationId);
      await loadUserOrganizations();
    } catch (err: any) {
      alert(`Failed to change role: ${err.message}`);
    }
  };

  const handleOpenCapabilityEditor = (userOrg: UserOrganization) => {
    setSelectedUserOrg(userOrg);
  };

  const handleSaveCapabilities = async (capabilities: Record<string, boolean>) => {
    if (!selectedUserOrg) return;

    try {
      await apiClient.updateUserOrgCapabilities(
        selectedUserOrg.id,
        capabilities,
        organizationId
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
      await apiClient.revokeUserOrganization(revokeUserOrgId, organizationId, reason);
      setRevokeUserOrgId(null);
      await loadUserOrganizations();
    } catch (err: any) {
      alert(`Failed to revoke access: ${err.message}`);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <div>
            <h3 className="text-lg font-bold text-slate-100">Organization Permissions</h3>
            <p className="text-sm text-slate-400 mt-1">
              Manage user's access and capabilities across organizations
            </p>
          </div>
        </div>
        <button
          onClick={loadUserOrganizations}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 text-slate-300">
          <Building2 className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">
            Total Organizations: <span className="text-blue-400">{userOrgs.length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Custom Permissions:{' '}
            <span className="text-orange-400">{userOrgs.filter(uo => uo.isCustom).length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            PEMS Assignments:{' '}
            <span className="text-blue-400">
              {userOrgs.filter(uo => uo.assignmentSource === 'pems_sync').length}
            </span>
          </span>
        </div>
      </div>

      {/* Organizations Table */}
      {userOrgs.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No organization assignments found</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Capabilities
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {userOrgs.map((userOrg) => (
                  <tr key={userOrg.id} className="hover:bg-slate-700/50 transition-colors">
                    {/* Organization */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 font-semibold">
                          {userOrg.organization?.code?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">
                              {userOrg.organization?.code || 'Unknown'}
                            </span>
                            {userOrg.organization?.isExternal && (
                              <ProviderBadge provider="pems" size="sm" />
                            )}
                          </div>
                          <span className="text-sm text-slate-400">
                            {userOrg.organization?.name || ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <select
                        value={userOrg.role}
                        onChange={(e) => handleRoleChange(userOrg, e.target.value)}
                        disabled={
                          userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom
                        }
                        className={`px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500 ${
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

                    {/* Source */}
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`${
                            userOrg.assignmentSource === 'pems_sync'
                              ? 'text-blue-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {userOrg.assignmentSource === 'pems_sync' ? 'PEMS Sync' : 'Local'}
                        </span>
                        {userOrg.isCustom && (
                          <span className="text-xs text-orange-400">Custom Permissions</span>
                        )}
                      </div>
                    </td>

                    {/* Capabilities */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleOpenCapabilityEditor(userOrg)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors text-sm"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configure ({userOrg.enabledCapabilitiesCount} enabled)
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setRevokeUserOrgId(userOrg.id)}
                        disabled={
                          userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom
                        }
                        className={`p-2 rounded transition-colors ${
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
        </div>
      )}

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
