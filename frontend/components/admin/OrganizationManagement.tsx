/**
 * OrganizationManagement Component
 * Phase 5, Task 5.2 - Organization Service Status Controls
 *
 * Admin dashboard for managing organizations:
 * - View all organizations with status and sync settings
 * - Suspend/Activate/Archive organizations
 * - Toggle sync settings
 * - Edit organization details
 * - PEMS organization indicators and unlink functionality
 */

import { useState, useEffect } from 'react';
import {
  Building2,
  Edit,
  Trash2,
  RefreshCw,
  Pause,
  Play,
  Archive,
  AlertCircle,
  Unlink,
  ToggleLeft,
  ToggleRight,
  Plus,
  Download,
  Loader2,
} from 'lucide-react';
import type { ApiOrganization } from '../../types';

// Organization Avatar component with image/initials fallback
function OrgAvatar({ org, size = 'md' }: { org: { code: string; logoUrl?: string }; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false);

  // Reset error state when logoUrl changes
  useEffect(() => {
    setImgError(false);
  }, [org.logoUrl]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  const initial = org.code.charAt(0).toUpperCase();

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 font-semibold overflow-hidden`}>
      {org.logoUrl && !imgError ? (
        <img
          src={org.logoUrl}
          alt={org.code}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
import { apiClient } from '../../services/apiClient';
import { StatusBadge, ProviderBadge } from '../StatusBadge';
import { EditOrganizationModal } from './EditOrganizationModal';
import { UnlinkConfirmDialog } from './UnlinkConfirmDialog';

interface OrganizationManagementProps {
  onOrganizationUpdated?: () => Promise<void>;
}

export function OrganizationManagement({ onOrganizationUpdated }: OrganizationManagementProps) {
  const [organizations, setOrganizations] = useState<ApiOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<ApiOrganization | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState<string | null>(null);
  const [unlinkOrgId, setUnlinkOrgId] = useState<string | null>(null);
  const [syncingOrgId, setSyncingOrgId] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getOrganizations();
      setOrganizations(response.organizations);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (orgId: string) => {
    try {
      await apiClient.suspendOrganization(orgId, suspendReason);
      setShowSuspendDialog(null);
      setSuspendReason('');
      await loadOrganizations();
    } catch (err: any) {
      alert(`Failed to suspend organization: ${err.message}`);
    }
  };

  const handleActivate = async (orgId: string) => {
    try {
      await apiClient.activateOrganization(orgId);
      await loadOrganizations();
    } catch (err: any) {
      alert(`Failed to activate organization: ${err.message}`);
    }
  };

  const handleArchive = async (orgId: string) => {
    try {
      await apiClient.archiveOrganization(orgId, archiveReason);
      setShowArchiveDialog(null);
      setArchiveReason('');
      await loadOrganizations();
    } catch (err: any) {
      alert(`Failed to archive organization: ${err.message}`);
    }
  };

  const handleToggleSync = async (org: ApiOrganization, enabled: boolean) => {
    if (!enabled || org.serviceStatus === 'active') {
      try {
        await apiClient.toggleOrganizationSync(org.id, enabled);
        await loadOrganizations();
      } catch (err: any) {
        alert(`Failed to toggle sync: ${err.message}`);
      }
    }
  };

  const handleDelete = async (org: ApiOrganization) => {
    if (org.isExternal) {
      alert('Cannot delete PEMS organizations. Unlink them instead.');
      return;
    }

    if (!confirm(`Are you sure you want to delete organization "${org.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.deleteOrganization(org.id);
      await loadOrganizations();
    } catch (err: any) {
      alert(`Failed to delete organization: ${err.message}`);
    }
  };

  const handleSyncOrg = async (org: ApiOrganization) => {
    if (org.serviceStatus !== 'active') {
      alert(`Cannot sync ${org.serviceStatus} organizations.`);
      return;
    }

    try {
      setSyncingOrgId(org.id);
      const result = await apiClient.syncOrgApis(org.id, 'full');
      if (result.success) {
        alert(`Sync initiated for ${org.name}: ${result.syncs?.length || 0} endpoints queued.`);
      } else {
        alert(`Sync failed: ${result.message}`);
      }
    } catch (err: any) {
      alert(`Failed to sync organization: ${err.message}`);
    } finally {
      setSyncingOrgId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
          <Building2 className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Organizations</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage organizations and sync settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Organization
          </button>
          <button
            onClick={loadOrganizations}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
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

      {/* Organization Count */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 text-slate-300">
          <Building2 className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">
            Total Organizations: <span className="text-blue-400">{organizations.length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Active: <span className="text-green-400">{organizations.filter(o => o.serviceStatus === 'active').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Suspended: <span className="text-yellow-400">{organizations.filter(o => o.serviceStatus === 'suspended').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Archived: <span className="text-gray-400">{organizations.filter(o => o.serviceStatus === 'archived').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            PEMS Orgs: <span className="text-blue-400">{organizations.filter(o => o.isExternal).length}</span>
          </span>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Sync
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  First Sync
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Last Sync
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onDoubleClick={() => setSelectedOrg(org)}
                  title="Double-click to edit"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <OrgAvatar org={org} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">
                            {org.code}
                          </span>
                          {org.isExternal && <ProviderBadge provider="pems" size="sm" />}
                        </div>
                        <span className="text-sm text-slate-400">{org.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={org.serviceStatus} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleSync(org, !org.enableSync)}
                      disabled={org.serviceStatus === 'suspended' || org.serviceStatus === 'archived'}
                      className={`p-2 rounded transition-colors ${
                        org.serviceStatus === 'suspended' || org.serviceStatus === 'archived'
                          ? 'text-slate-600 cursor-not-allowed'
                          : org.enableSync
                          ? 'text-green-400 hover:bg-green-500/20'
                          : 'text-slate-400 hover:bg-slate-700'
                      }`}
                      title={
                        org.serviceStatus === 'suspended' || org.serviceStatus === 'archived'
                          ? `Cannot enable sync for ${org.serviceStatus} organizations`
                          : org.enableSync
                          ? 'Sync Enabled - Click to disable'
                          : 'Sync Disabled - Click to enable'
                      }
                    >
                      {org.enableSync ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {org.userCount} users
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`${org.isExternal ? 'text-blue-400' : 'text-slate-400'}`}>
                      {org.isExternal ? 'PEMS' : 'Local'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                    {org.firstSyncAt ? formatDate(org.firstSyncAt) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                    {org.lastSyncAt ? formatDate(org.lastSyncAt) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {/* Sync Button - Always visible for active orgs */}
                      {org.serviceStatus === 'active' && (
                        <button
                          onClick={() => handleSyncOrg(org)}
                          disabled={syncingOrgId === org.id}
                          className="p-2 hover:bg-cyan-500/20 text-cyan-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sync all endpoints for this organization"
                        >
                          {syncingOrgId === org.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Status Controls */}
                      {org.serviceStatus === 'active' && (
                        <>
                          <button
                            onClick={() => setShowSuspendDialog(org.id)}
                            className="p-2 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors"
                            title="Suspend Organization"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowArchiveDialog(org.id)}
                            className="p-2 hover:bg-gray-500/20 text-gray-400 rounded transition-colors"
                            title="Archive Organization"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {org.serviceStatus === 'suspended' && (
                        <button
                          onClick={() => handleActivate(org.id)}
                          className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                          title="Activate Organization"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      {/* Edit Button */}
                      <button
                        onClick={() => setSelectedOrg(org)}
                        className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                        title="Edit Organization"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* Unlink Button (PEMS orgs only) */}
                      {org.isExternal && (
                        <button
                          onClick={() => setUnlinkOrgId(org.id)}
                          className="p-2 hover:bg-orange-500/20 text-orange-400 rounded transition-colors"
                          title="Unlink from PEMS"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete Button (Local orgs only) */}
                      {!org.isExternal && org.serviceStatus !== 'archived' && (
                        <button
                          onClick={() => handleDelete(org)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                          title="Delete Organization"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Dialog */}
      {showSuspendDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Suspend Organization</h3>
            <p className="text-sm text-slate-300 mb-4">
              Provide a reason for suspending this organization (optional):
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g., Project on hold, budget exhausted, etc."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleSuspend(showSuspendDialog)}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition-colors"
              >
                Suspend Organization
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

      {/* Archive Dialog */}
      {showArchiveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Archive Organization</h3>
            <p className="text-sm text-slate-300 mb-4">
              Archiving will disable sync and prevent further operations. Provide a reason (optional):
            </p>
            <textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g., Project completed, no longer needed, etc."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleArchive(showArchiveDialog)}
                className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium transition-colors"
              >
                Archive Organization
              </button>
              <button
                onClick={() => {
                  setShowArchiveDialog(null);
                  setArchiveReason('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {selectedOrg && (
        <EditOrganizationModal
          organization={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onSave={async () => {
            setSelectedOrg(null);
            await loadOrganizations();
            await onOrganizationUpdated?.();
          }}
        />
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <EditOrganizationModal
          organization={null}
          onClose={() => setShowCreateModal(false)}
          onSave={async () => {
            setShowCreateModal(false);
            await loadOrganizations();
            await onOrganizationUpdated?.();
          }}
        />
      )}

      {/* Unlink Confirmation Dialog */}
      {unlinkOrgId && (
        <UnlinkConfirmDialog
          organizationId={unlinkOrgId}
          onConfirm={async (reason) => {
            try {
              await apiClient.unlinkOrganization(unlinkOrgId, reason);
              setUnlinkOrgId(null);
              await loadOrganizations();
            } catch (err: any) {
              alert(`Failed to unlink organization: ${err.message}`);
            }
          }}
          onCancel={() => setUnlinkOrgId(null)}
        />
      )}
    </div>
  );
}
