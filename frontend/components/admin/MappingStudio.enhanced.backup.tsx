// @ts-nocheck - Backup file
/**
 * @file MappingStudioEnhanced.tsx
 * @description Enhanced visual field mapping studio - ADR-007 Task 5.2
 * Features: SVG mapping lines, transform selector, validation, CSV import/export
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Loader2,
  Upload,
  Download,
  AlertTriangle
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

// Draggable source field with ref forwarding
const SourceField: React.FC<{
  name: string;
  isUsed: boolean;
  onRefChange: (el: HTMLDivElement | null) => void;
}> = ({ name, isUsed, onRefChange }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${name}`,
    data: { sourceField: name }
  });

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    onRefChange(node);
  }, [setNodeRef, onRefChange]);

  return (
    <div
      ref={combinedRef}
      {...listeners}
      {...attributes}
      className={`
        px-3 py-2 rounded border cursor-move transition-all
        ${isUsed ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 hover:border-blue-400'}
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
      data-source-field={name}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono">{name}</span>
        {isUsed && <CheckCircle2 className="w-3 h-3" />}
      </div>
    </div>
  );
};

// Droppable destination field with transform selector
const DestinationField: React.FC<{
  field: typeof PFA_FIELDS[0];
  mapping?: FieldMapping;
  onRemove: () => void;
  onTransformChange: (transformType: string) => void;
  onRefChange: (el: HTMLDivElement | null) => void;
}> = ({ field, mapping, onRemove, onTransformChange, onRefChange }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `dest-${field.name}`,
    data: { destinationField: field.name, dataType: field.dataType }
  });

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    onRefChange(node);
  }, [setNodeRef, onRefChange]);

  return (
    <div
      ref={combinedRef}
      className={`
        px-3 py-2 rounded border transition-all
        ${mapping ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200'}
        ${isOver ? 'border-blue-500 bg-blue-50' : ''}
        ${field.required && !mapping ? 'border-l-4 border-l-orange-400' : ''}
      `}
      data-dest-field={field.name}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{field.label}</span>
            {field.required && <span className="text-xs text-orange-600">*</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{field.name}</span>
            <span className="text-xs text-gray-400">({field.dataType})</span>
          </div>
          {mapping && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-green-700 font-mono">← {mapping.sourceField}</span>
              <select
                value={mapping.transformType}
                onChange={(e) => onTransformChange(e.target.value)}
                className="text-xs px-2 py-1 border rounded bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                {TRANSFORM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {mapping && (
          <button
            onClick={onRemove}
            className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// SVG mapping lines component
const MappingLines: React.FC<{
  mappings: FieldMapping[];
  sourceRefs: Map<string, DOMRect>;
  destRefs: Map<string, DOMRect>;
  containerRect: DOMRect | null;
}> = ({ mappings, sourceRefs, destRefs, containerRect }) => {
  if (!containerRect) return null;

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {mappings.map((mapping) => {
        const sourceRect = sourceRefs.get(mapping.sourceField);
        const destRect = destRefs.get(mapping.destinationField);

        if (!sourceRect || !destRect) return null;

        // Calculate line positions relative to container
        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top - containerRect.top + sourceRect.height / 2;
        const x2 = destRect.left - containerRect.left;
        const y2 = destRect.top - containerRect.top + destRect.height / 2;

        // Create curved path
        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${(y1 + y2) / 2} Q ${midX} ${y2}, ${x2} ${y2}`;

        return (
          <g key={mapping.id}>
            {/* Shadow line */}
            <path
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3"
              opacity="0.3"
            />
            {/* Main line */}
            <path
              d={path}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray={mapping.transformType !== 'direct' ? '5,5' : '0'}
            />
            {/* Arrowhead */}
            <polygon
              points={`${x2},${y2} ${x2-8},${y2-4} ${x2-8},${y2+4}`}
              fill="#3b82f6"
            />
          </g>
        );
      })}
    </svg>
  );
};

export const MappingStudioEnhanced: React.FC<MappingStudioProps> = ({
  endpointId: propEndpointId,
  onClose
}) => {
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Refs for SVG line drawing
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const sourceRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const destRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [sourceRects, setSourceRects] = useState<Map<string, DOMRect>>(new Map());
  const [destRects, setDestRects] = useState<Map<string, DOMRect>>(new Map());

  // Update rect positions
  const updateRects = useCallback(() => {
    if (!containerRef.current) return;

    const newContainerRect = containerRef.current.getBoundingClientRect();
    setContainerRect(newContainerRect);

    const newSourceRects = new Map<string, DOMRect>();
    sourceRefsMap.current.forEach((el, key) => {
      if (el) newSourceRects.set(key, el.getBoundingClientRect());
    });
    setSourceRects(newSourceRects);

    const newDestRects = new Map<string, DOMRect>();
    destRefsMap.current.forEach((el, key) => {
      if (el) newDestRects.set(key, el.getBoundingClientRect());
    });
    setDestRects(newDestRects);
  }, []);

  useEffect(() => {
    updateRects();
    window.addEventListener('resize', updateRects);
    return () => window.removeEventListener('resize', updateRects);
  }, [updateRects, mappings, sourceFields]);

  useEffect(() => {
    fetchEndpoints();
  }, []);

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

    const filtered = mappings.filter(m => m.destinationField !== destinationField);

    const newMapping: FieldMapping = {
      id: `${sourceField}-${destinationField}`,
      sourceField,
      destinationField,
      dataType,
      transformType: 'direct'
    };

    setMappings([...filtered, newMapping]);
    validateMappings([...filtered, newMapping]);
    setTimeout(updateRects, 50);
  };

  const handleRemoveMapping = (destinationField: string) => {
    const updated = mappings.filter(m => m.destinationField !== destinationField);
    setMappings(updated);
    validateMappings(updated);
    setTimeout(updateRects, 50);
  };

  const handleTransformChange = (destinationField: string, transformType: string) => {
    setMappings(mappings.map(m =>
      m.destinationField === destinationField
        ? { ...m, transformType }
        : m
    ));
  };

  // Validation: Check required fields are mapped
  const validateMappings = (currentMappings: FieldMapping[]) => {
    const mappedDestFields = new Set(currentMappings.map(m => m.destinationField));
    const unmappedRequired = PFA_FIELDS
      .filter(f => f.required && !mappedDestFields.has(f.name))
      .map(f => f.label);

    setValidationErrors(unmappedRequired);
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

    // Final validation before save
    if (validationErrors.length > 0) {
      setError(`Required fields unmapped: ${validationErrors.join(', ')}`);
      return;
    }

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
      setValidationErrors([]);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (mappings.length === 0) return;

    const csv = [
      'sourceField,destinationField,dataType,transformType',
      ...mappings.map(m =>
        `${m.sourceField},${m.destinationField},${m.dataType},${m.transformType}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mappings-${selectedEndpoint}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.trim().split('\n');
        const headers = lines[0].split(',');

        const imported: FieldMapping[] = lines.slice(1).map((line, idx) => {
          const values = line.split(',');
          return {
            id: `imported-${idx}`,
            sourceField: values[0],
            destinationField: values[1],
            dataType: values[2] || 'string',
            transformType: values[3] || 'direct'
          };
        });

        setMappings(imported);
        validateMappings(imported);
        setTimeout(updateRects, 50);
        alert(`✅ Imported ${imported.length} mappings`);
      } catch (err) {
        setError('Failed to parse CSV. Ensure format: sourceField,destinationField,dataType,transformType');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
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

        {/* Validation Warnings */}
        {validationErrors.length > 0 && (
          <div className="mt-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-orange-800">Required fields unmapped ({validationErrors.length})</div>
              <div className="text-xs text-orange-700 mt-1">{validationErrors.join(', ')}</div>
            </div>
          </div>
        )}

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
          <div ref={containerRef} className="flex-1 overflow-auto px-6 py-4 relative">
            {/* SVG Mapping Lines */}
            <MappingLines
              mappings={mappings}
              sourceRefs={sourceRects}
              destRefs={destRects}
              containerRect={containerRect}
            />

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8 relative" style={{ zIndex: 2 }}>
                {/* Source Fields */}
                <div>
                  <h3 className="font-semibold mb-3">Source Fields (PEMS)</h3>
                  <div className="space-y-2">
                    {sourceFields.map(field => (
                      <SourceField
                        key={field}
                        name={field}
                        isUsed={usedSourceFields.has(field)}
                        onRefChange={(el) => {
                          if (el) {
                            sourceRefsMap.current.set(field, el);
                          } else {
                            sourceRefsMap.current.delete(field);
                          }
                          updateRects();
                        }}
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
                          onTransformChange={(type) => handleTransformChange(field.name, type)}
                          onRefChange={(el) => {
                            if (el) {
                              destRefsMap.current.set(field.name, el);
                            } else {
                              destRefsMap.current.delete(field.name);
                            }
                            updateRects();
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Preview Panel */}
            {previewData.length > 0 && (
              <div className="mt-8 border-t pt-6 relative" style={{ zIndex: 2 }}>
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
            <button
              onClick={handleExportCSV}
              disabled={mappings.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
            </span>
            {validationErrors.length > 0 && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {validationErrors.length} required field{validationErrors.length !== 1 ? 's' : ''} unmapped
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={mappings.length === 0 || saving || validationErrors.length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
