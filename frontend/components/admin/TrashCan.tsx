/**
 * TrashCan Component (ADR-005)
 *
 * Data recovery console for soft-deleted records.
 * Features:
 * - View deleted items by entity type
 * - Restore functionality with confirmation
 * - Permanent purge with dependency warnings
 * - Filter by entity type
 */

import { useState, useEffect } from 'react';
import {
  Trash2,
  RefreshCw,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { ApiTrashItem } from '../../types';

const ENTITY_TYPES = ['User', 'Organization', 'PfaRecord', 'ApiServer'];

export function TrashCan() {
  const [items, setItems] = useState<ApiTrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [confirmRestore, setConfirmRestore] = useState<ApiTrashItem | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<ApiTrashItem | null>(null);

  useEffect(() => {
    loadTrashItems();
  }, [entityTypeFilter]);

  const loadTrashItems = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTrashItems(entityTypeFilter || undefined);
      setItems(response.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load trash items');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: ApiTrashItem) => {
    try {
      await apiClient.restoreTrashItem(item.id);
      setConfirmRestore(null);
      await loadTrashItems();
    } catch (err: any) {
      alert(`Failed to restore item: ${err.message}`);
    }
  };

  const handlePurge = async (item: ApiTrashItem) => {
    try {
      await apiClient.purgeTrashItem(item.id);
      setConfirmPurge(null);
      await loadTrashItems();
    } catch (err: any) {
      alert(`Failed to purge item: ${err.message}`);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Permanently delete all items in trash? This cannot be undone.')) {
      return;
    }

    try {
      const response = await apiClient.emptyTrash(entityTypeFilter || undefined);
      alert(`Permanently deleted ${response.purgedCount} items`);
      await loadTrashItems();
    } catch (err: any) {
      alert(`Failed to empty trash: ${err.message}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trash2 className="w-8 h-8 text-red-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Trash Can</h2>
            <p className="text-sm text-slate-400 mt-1">
              Recover or permanently delete soft-deleted items
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTrashItems}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {items.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <Filter className="w-5 h-5 text-slate-400" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Entity Type:</span>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="px-3 py-1 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Types</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-slate-400">
          {items.length} item{items.length !== 1 ? 's' : ''} in trash
        </div>
      </div>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <Trash2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Trash is empty</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Entity Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Deleted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Deleted At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Dependencies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-300">{item.entityType}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-100">{item.entityName}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{item.deletedBy}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {formatDate(item.deletedAt)}
                    </td>
                    <td className="px-6 py-4">
                      {item.dependencies && item.dependencies.length > 0 ? (
                        <div className="text-sm text-yellow-400">
                          {item.dependencies.map((dep, idx) => (
                            <div key={idx}>
                              {dep.count} {dep.type}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmRestore(item)}
                          className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmPurge(item)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                          title="Permanent Delete"
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
      )}

      {/* Restore Confirmation Modal */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-bold text-slate-100">Restore Item</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Restore "{confirmRestore.entityName}"? This will undelete the item and make it active
              again.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(confirmRestore)}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
              >
                Restore
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {confirmPurge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full border border-red-500/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-slate-100">Permanent Delete</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Permanently delete "{confirmPurge.entityName}"? This action cannot be undone.
            </p>
            {confirmPurge.dependencies && confirmPurge.dependencies.length > 0 && (
              <div className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-4 py-3 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">Dependencies Warning</div>
                    {confirmPurge.dependencies.map((dep, idx) => (
                      <div key={idx} className="text-sm">
                        Cannot delete because it has {dep.count} {dep.type}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handlePurge(confirmPurge)}
                disabled={
                  confirmPurge.dependencies && confirmPurge.dependencies.length > 0
                }
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Permanent Delete
              </button>
              <button
                onClick={() => setConfirmPurge(null)}
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
