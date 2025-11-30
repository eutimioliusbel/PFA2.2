/**
 * SystemDictionaryEditor Component (ADR-005)
 * Dropdown management for dynamic system dictionaries
 */

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit, Trash2, RefreshCw, AlertCircle, GripVertical, Save } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { DictionaryEntry } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export function SystemDictionaryEditor() {
  const { hasPermission } = useAuth();
  const canManageSettings = hasPermission('perm_ManageSettings');

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadEntries();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDictionaryCategories();
      setCategories(response.categories);
      if (response.categories.length > 0 && !selectedCategory) {
        setSelectedCategory(response.categories[0]);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDictionaryEntries(selectedCategory);
      setEntries(response.entries.sort((a, b) => a.order - b.order));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entry: DictionaryEntry) => {
    if (!confirm(`Delete entry "${entry.label}"?`)) {
      return;
    }

    try {
      await apiClient.deleteDictionaryEntry(entry.id);
      await loadEntries();
    } catch (err: any) {
      alert(`Failed to delete entry: ${err.message}`);
    }
  };

  const handleReorder = async (entries: DictionaryEntry[]) => {
    try {
      await apiClient.reorderDictionaryEntries(
        selectedCategory,
        entries.map((e) => e.id)
      );
      await loadEntries();
    } catch (err: any) {
      alert(`Failed to reorder entries: ${err.message}`);
    }
  };

  const moveEntry = (index: number, direction: 'up' | 'down') => {
    const newEntries = [...entries];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newEntries.length) return;

    [newEntries[index], newEntries[newIndex]] = [newEntries[newIndex], newEntries[index]];
    newEntries.forEach((entry, idx) => {
      entry.order = idx;
    });

    setEntries(newEntries);
    handleReorder(newEntries);
  };

  if (loading && !selectedCategory) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-green-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">System Dictionary Editor</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage dropdown options and system dictionaries
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadEntries}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {selectedCategory && canManageSettings && (
            <button
              onClick={() => {
                setSelectedEntry(null);
                setShowEditor(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* Category Selector */}
        <div className="col-span-1 bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
            Categories
          </h3>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  selectedCategory === category
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Entries List */}
        <div className="col-span-3 bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-slate-100">{selectedCategory}</h3>
            <p className="text-sm text-slate-400 mt-1">{entries.length} entries</p>
          </div>

          <div className="divide-y divide-slate-700">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="p-4 hover:bg-slate-700/50 transition-colors flex items-center gap-3"
              >
                {canManageSettings && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveEntry(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={() => moveEntry(index, 'down')}
                      disabled={index === entries.length - 1}
                      className="p-1 hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">{entry.label}</span>
                    {!entry.isActive && (
                      <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">
                    Value: <code className="text-blue-400">{entry.value}</code>
                  </div>
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      {JSON.stringify(entry.metadata)}
                    </div>
                  )}
                </div>

                {canManageSettings && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setShowEditor(true);
                      }}
                      className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEditor && (
        <EntryEditorModal
          entry={selectedEntry}
          category={selectedCategory}
          nextOrder={entries.length}
          onClose={() => {
            setShowEditor(false);
            setSelectedEntry(null);
          }}
          onSave={() => {
            setShowEditor(false);
            setSelectedEntry(null);
            loadEntries();
          }}
        />
      )}
    </div>
  );
}

interface EntryEditorModalProps {
  entry: DictionaryEntry | null;
  category: string;
  nextOrder: number;
  onClose: () => void;
  onSave: () => void;
}

function EntryEditorModal({ entry, category, nextOrder, onClose, onSave }: EntryEditorModalProps) {
  const [value, setValue] = useState(entry?.value || '');
  const [label, setLabel] = useState(entry?.label || '');
  const [order, setOrder] = useState(entry?.order ?? nextOrder);
  const [isActive, setIsActive] = useState(entry?.isActive ?? true);
  const [metadataJson, setMetadataJson] = useState(
    entry?.metadata ? JSON.stringify(entry.metadata, null, 2) : '{}'
  );

  const handleSubmit = async () => {
    if (!value.trim() || !label.trim()) {
      alert('Value and label are required');
      return;
    }

    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(metadataJson);
    } catch {
      alert('Invalid JSON in metadata field');
      return;
    }

    try {
      if (entry) {
        await apiClient.updateDictionaryEntry(entry.id, {
          value: value.trim(),
          label: label.trim(),
          order,
          isActive,
          metadata,
        });
      } else {
        await apiClient.createDictionaryEntry({
          category,
          value: value.trim(),
          label: label.trim(),
          order,
          metadata,
        });
      }
      onSave();
    } catch (err: any) {
      alert(`Failed to save entry: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700">
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-100">
            {entry ? 'Edit' : 'Add'} Dictionary Entry
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Value (System Key)
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g., RENTAL"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Label (Display Text)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Rental Equipment"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Sort Order</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <label className="flex items-center gap-2 p-3 bg-slate-900 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-300">Active</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Metadata (JSON)
            </label>
            <textarea
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 font-mono text-sm focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional: Add custom fields like conversion_factor, color, icon, etc.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {entry ? 'Update' : 'Create'} Entry
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
    </div>
  );
}
