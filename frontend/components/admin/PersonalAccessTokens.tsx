/**
 * PersonalAccessTokens Component (ADR-005)
 *
 * PAT management with secure token display.
 * Features:
 * - Token list with scopes, created date, last used
 * - Creation modal with scope selection and expiry
 * - Copy-once security pattern for new tokens
 * - Revoke action with confirmation
 */

import { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  X,
  EyeOff,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { ApiPersonalAccessToken, PermissionKey } from '../../types';

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  perm_Read: 'View PFA Records',
  perm_EditForecast: 'Modify Forecast',
  perm_EditActuals: 'Modify Actuals',
  perm_Delete: 'Delete Records',
  perm_Import: 'CSV Import',
  perm_RefreshData: 'Trigger Sync',
  perm_Export: 'Excel Export',
  perm_ViewFinancials: 'View Financials',
  perm_SaveDraft: 'Save Draft',
  perm_Sync: 'Push to PEMS',
  perm_ManageUsers: 'Manage Users',
  perm_ManageSettings: 'Manage Settings',
  perm_ConfigureAlerts: 'Configure Alerts',
  perm_Impersonate: 'Impersonate Users',
  perm_UseAiFeatures: 'Use AI Features',
};

const EXPIRY_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'Never', value: 0 },
];

export function PersonalAccessTokens() {
  const [tokens, setTokens] = useState<ApiPersonalAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiPersonalAccessToken | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPersonalAccessTokens();
      setTokens(response.tokens);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load personal access tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (token: ApiPersonalAccessToken) => {
    try {
      await apiClient.revokePersonalAccessToken(token.id);
      setConfirmRevoke(null);
      await loadTokens();
    } catch (err: any) {
      alert(`Failed to revoke token: ${err.message}`);
    }
  };

  const handleDelete = async (token: ApiPersonalAccessToken) => {
    if (!confirm(`Delete token "${token.name}"?`)) {
      return;
    }

    try {
      await apiClient.deletePersonalAccessToken(token.id);
      await loadTokens();
    } catch (err: any) {
      alert(`Failed to delete token: ${err.message}`);
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
          <Key className="w-8 h-8 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Personal Access Tokens</h2>
            <p className="text-sm text-slate-400 mt-1">
              API tokens for programmatic access
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTokens}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
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

      {/* Tokens Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Scopes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tokens.map((token) => (
                <tr
                  key={token.id}
                  className={`hover:bg-slate-700/50 transition-colors ${
                    token.revoked ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{token.name}</span>
                      {token.revoked && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                          Revoked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {token.scopes.slice(0, 3).map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded"
                        >
                          {scope.replace('perm_', '')}
                        </span>
                      ))}
                      {token.scopes.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{token.scopes.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {formatDate(token.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {formatDate(token.lastUsedAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {!token.revoked && (
                        <button
                          onClick={() => setConfirmRevoke(token)}
                          className="p-2 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors"
                          title="Revoke Token"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(token)}
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        title="Delete Token"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Token Modal */}
      {showCreateModal && (
        <CreateTokenModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(token: string) => {
            setNewToken(token);
            setShowTokenModal(true);
            setShowCreateModal(false);
            loadTokens();
          }}
        />
      )}

      {/* Show Token Modal (Copy Once) */}
      {showTokenModal && newToken && (
        <ShowTokenModal
          token={newToken}
          onClose={() => {
            setShowTokenModal(false);
            setNewToken(null);
          }}
        />
      )}

      {/* Revoke Confirmation Modal */}
      {confirmRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Revoke Token</h3>
            <p className="text-sm text-slate-300 mb-4">
              Revoke "{confirmRevoke.name}"? This will immediately invalidate the token.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRevoke(confirmRevoke)}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition-colors"
              >
                Revoke Token
              </button>
              <button
                onClick={() => setConfirmRevoke(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CreateTokenModalProps {
  onClose: () => void;
  onSuccess: (token: string) => void;
}

function CreateTokenModal({ onClose, onSuccess }: CreateTokenModalProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<PermissionKey[]>([]);
  const [expiryDays, setExpiryDays] = useState(30);

  const handleToggleScope = (scope: PermissionKey) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Token name is required');
      return;
    }
    if (scopes.length === 0) {
      alert('At least one scope is required');
      return;
    }

    try {
      const expiresAt = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const response = await apiClient.createPersonalAccessToken({
        name: name.trim(),
        scopes,
        expiresAt,
      });

      onSuccess(response.token);
    } catch (err: any) {
      alert(`Failed to create token: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <h2 className="text-xl font-bold text-slate-100">Create Personal Access Token</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Token Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CI/CD Pipeline, Mobile App"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Expiry</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-yellow-500"
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Scopes (Select at least one)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map((scope) => (
                <label
                  key={scope}
                  className="flex items-center gap-2 p-3 bg-slate-900 rounded cursor-pointer hover:bg-slate-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => handleToggleScope(scope)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300">{PERMISSION_LABELS[scope]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-6 border-t border-slate-700 bg-slate-900">
          <button
            onClick={handleCreate}
            className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition-colors"
          >
            Generate Token
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

interface ShowTokenModalProps {
  token: string;
  onClose: () => void;
}

function ShowTokenModal({ token, onClose }: ShowTokenModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-yellow-500/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-500" />
          <h3 className="text-lg font-bold text-slate-100">Copy Your Token</h3>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-lg mb-4">
          <p className="text-sm font-medium">
            This token will only be shown once. Copy it now and store it securely.
          </p>
        </div>
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-green-400 break-all">{token}</code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
        >
          I've Saved My Token
        </button>
      </div>
    </div>
  );
}
