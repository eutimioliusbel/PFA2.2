/**
 * EditableMasterView Component
 *
 * CRUD-enabled master data view with modal forms for add/edit operations.
 * Extends GenericMasterView pattern with full editing capabilities.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, RefreshCw, Database, Plus, Edit, Trash2, X, Check, AlertCircle } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  width?: string;
  editable?: boolean;
  type?: 'text' | 'select';
  options?: { value: string; label: string }[];
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface EditableMasterViewProps {
  title: string;
  description: string;
  data: Array<Record<string, unknown>>;
  columns: Column[];
  formFields: FormField[];
  icon?: React.ComponentType<{ className?: string }>;
  onRefresh?: () => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canEdit: boolean;
  idField?: string;
}

export const EditableMasterView: React.FC<EditableMasterViewProps> = ({
  title,
  description,
  data,
  columns,
  formFields,
  icon: Icon = Database,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  canEdit,
  idField = 'id',
}) => {
  const [search, setSearch] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(
    () =>
      data.filter((r) =>
        columns.some((col) => String(r[col.key] || '').toLowerCase().includes(search.toLowerCase()))
      ),
    [data, search, columns]
  );

  const ROW_HEIGHT = 48;
  const OVERSCAN = 10;
  const totalHeight = filtered.length * ROW_HEIGHT;
  const startOffset = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    filtered.length,
    Math.floor((scrollTop + (scrollContainerRef.current?.clientHeight || 600)) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleRows = filtered.slice(startIndex, endIndex);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (scrollContainerRef.current) setScrollTop(scrollContainerRef.current.scrollTop);
  }, []);

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData({});
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (record: Record<string, unknown>) => {
    setEditingRecord(record);
    const initialData: Record<string, string> = {};
    formFields.forEach((field) => {
      initialData[field.key] = String(record[field.key] || '');
    });
    setFormData(initialData);
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setFormData({});
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate required fields
      for (const field of formFields) {
        if (field.required && !formData[field.key]?.trim()) {
          throw new Error(`${field.label} is required`);
        }
      }

      const submitData: Record<string, unknown> = {};
      formFields.forEach((field) => {
        const value = formData[field.key]?.trim();
        if (value) {
          submitData[field.key] = value;
        }
      });

      if (editingRecord) {
        await onUpdate(String(editingRecord[idField]), submitData);
      } else {
        await onCreate(submitData);
      }

      closeModal();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDelete(id);
      setDeleteConfirm(null);
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-slate-100 placeholder-slate-500"
            />
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
          {canEdit && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 text-slate-300">
          <Icon className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">
            Total Records: <span className="text-blue-400">{data.length}</span>
          </span>
          {search && (
            <>
              <span className="mx-2 text-slate-600">|</span>
              <span className="font-semibold">
                Filtered: <span className="text-cyan-400">{filtered.length}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div
          className="overflow-x-auto h-[calc(100vh-320px)]"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-900 border-b border-slate-700">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    style={{ width: col.width || 'auto' }}
                  >
                    {col.label}
                  </th>
                ))}
                {canEdit && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-24">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
          </table>
          <div style={{ height: totalHeight, position: 'relative' }}>
            <table
              className="w-full text-left text-sm whitespace-nowrap absolute top-0 left-0 table-fixed"
              style={{ transform: `translateY(${startOffset}px)` }}
            >
              <colgroup>
                {columns.map((col) => (
                  <col key={col.key} style={{ width: col.width || 'auto' }} />
                ))}
                {canEdit && <col style={{ width: '96px' }} />}
              </colgroup>
              <tbody className="divide-y divide-slate-700">
                {visibleRows.map((record, idx) => (
                  <tr
                    key={String(record[idField]) || idx}
                    className="hover:bg-slate-700/50 transition-colors"
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`px-6 py-3 truncate ${colIdx === 0 ? 'font-medium text-slate-100' : 'text-slate-300'}`}
                      >
                        {String(record[col.key] || '-')}
                      </td>
                    ))}
                    {canEdit && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(record)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(String(record[idField]))}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-400 italic">No records found.</div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingRecord ? `Edit ${title.slice(0, -1)}` : `Add New ${title.slice(0, -1)}`}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {formFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    />
                  )}
                </div>
              ))}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingRecord ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Delete Record</h3>
                <p className="text-sm text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteConfirm(null);
                  setError(null);
                }}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white rounded-lg transition-colors"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
