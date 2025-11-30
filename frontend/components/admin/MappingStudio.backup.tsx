// @ts-nocheck - Backup file
/**
 * @file MappingStudio.tsx
 * @description Visual field mapping studio with drag-and-drop - ADR-007 Task 5.2
 * Admin drags PEMS source fields to PFA destination fields to configure transformations
 */

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core';
import {
  ArrowRight,
  Trash2,
  Eye,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

// PFA Field definitions for destination
const PFA_FIELDS = [
  { name: 'pfaId', label: 'PFA ID', dataType: 'string', required: true },
  { name: 'areaSilo', label: 'Area/Silo', dataType: 'string', required: true },
  { name: 'category', label: 'Category', dataType: 'string', required: true },
  { name: 'forecastCategory', label: 'Forecast Category', dataType: 'string', required: false },
  { name: 'class', label: 'Class', dataType: 'string', required: true },
  { name: 'source', label: 'Source (Rental/Purchase)', dataType: 'string', required: true },
  { name: 'dor', label: 'DOR (BEO/PROJECT)', dataType: 'string', required: true },
  { name: 'monthlyRate', label: 'Monthly Rate', dataType: 'number', required: false },
  { name: 'purchasePrice', label: 'Purchase Price', dataType: 'number', required: false },
  { name: 'manufacturer', label: 'Manufacturer', dataType: 'string', required: false },
  { name: 'model', label: 'Model', dataType: 'string', required: false },
  { name: 'originalStart', label: 'Original Start Date', dataType: 'date', required: true },
  { name: 'originalEnd', label: 'Original End Date', dataType: 'date', required: true },
  { name: 'forecastStart', label: 'Forecast Start Date', dataType: 'date', required: true },
  { name: 'forecastEnd', label: 'Forecast End Date', dataType: 'date', required: true },
  { name: 'actualStart', label: 'Actual Start Date', dataType: 'date', required: false },
  { name: 'actualEnd', label: 'Actual End Date', dataType: 'date', required: false },
  { name: 'contract', label: 'Contract', dataType: 'string', required: false },
  { name: 'equipment', label: 'Equipment Tag', dataType: 'string', required: false }
];

const TRANSFORM_TYPES = [
  { value: 'direct', label: 'Direct Copy' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'trim', label: 'Trim Whitespace' },
  { value: 'date_format', label: 'Date Format' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'divide', label: 'Divide' },
  { value: 'default', label: 'Default Value' }
];

interface FieldMapping {
  id: string;
  sourceField: string;
  destinationField: string;
  dataType: string;
  transformType: string;
  transformParams?: any;
}

interface MappingStudioProps {
  endpointId?: string;
  onClose?: () => void;
}

// Draggable source field
const SourceField: React.FC<{ name: string; isUsed: boolean }> = ({ name, isUsed }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${name}`,
    data: { sourceField: name }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        px-3 py-2 rounded border cursor-move transition-all
        ${isUsed ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 hover:border-blue-400'}
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono">{name}</span>
        {isUsed && <CheckCircle2 className="w-3 h-3" />}
      </div>
    </div>
  );
};

// Droppable destination field
const DestinationField: React.FC<{
  field: typeof PFA_FIELDS[0];
  mapping?: FieldMapping;
  onRemove: () => void;
}> = ({ field, mapping, onRemove }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `dest-${field.name}`,
    data: { destinationField: field.name, dataType: field.dataType }
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        px-3 py-2 rounded border transition-all
        ${mapping ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200'}
        ${isOver ? 'border-blue-500 bg-blue-50' : ''}
        ${field.required ? 'border-l-4 border-l-orange-400' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{field.label}</span>
            {field.required && <span className="text-xs text-orange-600">*</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{field.name}</span>
            <span className="text-xs text-gray-400">({field.dataType})</span>
          </div>
          {mapping && (
            <div className="mt-1 text-xs text-green-700 font-mono">
              ← {mapping.sourceField}
              {mapping.transformType !== 'direct' && ` [${mapping.transformType}]`}
            </div>
          )}
        </div>
        {mapping && (
          <button
            onClick={onRemove}
            className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const MappingStudio: React.FC<MappingStudioProps> = ({ endpointId: propEndpointId, onClose }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(propEndpointId || null);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch endpoints on mount
  useEffect(() => {
    fetchEndpoints();
  }, []);

  // Fetch source fields and existing mappings when endpoint is selected
  useEffect(() => {
    if (selectedEndpoint) {
      fetchSourceFields();
      fetchExistingMappings();
    }
  }, [selectedEndpoint]);

  const fetchEndpoints = async () => {
    try {
      const response = await fetch('/api/api-endpoints');
      if (!response.ok) throw new Error('Failed to fetch endpoints');
      const data = await response.json();
      setEndpoints(data.endpoints || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch endpoints');
    }
  };

  const fetchSourceFields = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/bronze/preview/${selectedEndpoint}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No Bronze data found for this endpoint. Run ingestion first.');
        }
        throw new Error('Failed to fetch source fields');
      }
      const data = await response.json();
      setSourceFields(data.fields || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch source fields');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingMappings = async () => {
    if (!selectedEndpoint) return;

    try {
      const response = await fetch(`/api/mappings/${selectedEndpoint}`);
      if (!response.ok) throw new Error('Failed to fetch existing mappings');
      const data = await response.json();
      setMappings(
        (data.mappings || []).map((m: any) => ({
          id: m.id,
          sourceField: m.sourceField,
          destinationField: m.destinationField,
          dataType: m.dataType,
          transformType: m.transformType || 'direct',
          transformParams: m.transformParams
        }))
      );
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const sourceField = active.data.current?.sourceField;
    const destinationField = over.data.current?.destinationField;
    const dataType = over.data.current?.dataType;

    if (!sourceField || !destinationField) return;

    // Remove existing mapping for this destination
    const filtered = mappings.filter(m => m.destinationField !== destinationField);

    // Add new mapping
    const newMapping: FieldMapping = {
      id: `${sourceField}-${destinationField}`,
      sourceField,
      destinationField,
      dataType,
      transformType: 'direct'
    };

    setMappings([...filtered, newMapping]);
  };

  const handleRemoveMapping = (destinationField: string) => {
    setMappings(mappings.filter(m => m.destinationField !== destinationField));
  };

  const handlePreview = async () => {
    if (!selectedEndpoint) return;

    setPreviewing(true);
    setError(null);
    try {
      const response = await fetch('/api/mappings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedEndpoint,
          mappings: mappings.map(m => ({
            sourceField: m.sourceField,
            destinationField: m.destinationField,
            transformType: m.transformType,
            transformParams: m.transformParams
          }))
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Preview failed');
      }

      const data = await response.json();
      setPreviewData(data.preview || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEndpoint) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/mappings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedEndpoint,
          mappings: mappings.map(m => ({
            sourceField: m.sourceField,
            destinationField: m.destinationField,
            dataType: m.dataType,
            transformType: m.transformType,
            transformParams: m.transformParams
          }))
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Save failed');
      }

      alert('✅ Mappings saved successfully!');
      if (onClose) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all mappings?')) {
      setMappings([]);
      setPreviewData([]);
    }
  };

  const usedSourceFields = new Set(mappings.map(m => m.sourceField));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Mapping Studio</h2>
            <p className="text-sm text-gray-600 mt-1">Drag PEMS fields to PFA fields to configure field mappings</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Endpoint Selector */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Select API Endpoint</label>
          <select
            value={selectedEndpoint || ''}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">-- Select Endpoint --</option>
            {endpoints.map(ep => (
              <option key={ep.id} value={ep.id}>
                {ep.name} ({ep.entity})
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      {selectedEndpoint && (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8">
                {/* Source Fields */}
                <div>
                  <h3 className="font-semibold mb-3">Source Fields (PEMS)</h3>
                  <div className="space-y-2">
                    {sourceFields.map(field => (
                      <SourceField
                        key={field}
                        name={field}
                        isUsed={usedSourceFields.has(field)}
                      />
                    ))}
                  </div>
                </div>

                {/* Destination Fields */}
                <div>
                  <h3 className="font-semibold mb-3">Destination Fields (PFA)</h3>
                  <div className="space-y-2">
                    {PFA_FIELDS.map(field => {
                      const mapping = mappings.find(m => m.destinationField === field.name);
                      return (
                        <DestinationField
                          key={field.name}
                          field={field}
                          mapping={mapping}
                          onRemove={() => handleRemoveMapping(field.name)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Preview Panel */}
            {previewData.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="font-semibold mb-3">Preview (Sample Data)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Original</th>
                        <th className="px-3 py-2 text-left"></th>
                        <th className="px-3 py-2 text-left">Mapped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2 align-top">
                            <pre className="text-xs bg-gray-50 p-2 rounded max-w-md overflow-x-auto">
                              {JSON.stringify(row.original, null, 2)}
                            </pre>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <pre className="text-xs bg-green-50 p-2 rounded max-w-md overflow-x-auto">
                              {JSON.stringify(row.mapped, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId ? (
              <div className="px-3 py-2 bg-blue-100 border border-blue-400 rounded shadow-lg">
                <span className="text-xs font-mono">{activeId.replace('source-', '')}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Actions */}
      {selectedEndpoint && !loading && (
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={mappings.length === 0 || previewing}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview
            </button>
            <button
              onClick={handleReset}
              disabled={mappings.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>

          <div className="flex gap-2">
            <span className="text-sm text-gray-600 mr-2">
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={mappings.length === 0 || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Mappings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
