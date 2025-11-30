/**
 * @file MappingStudio.tsx
 * @description Unified field mapping management for import/export operations.
 *
 * Features:
 * - Organizations-style list view with double-click to edit
 * - Entity-aware destination fields (PFA, Asset, BEO, etc.)
 * - Dynamic source fields from Bronze layer or internal schema
 * - Drag-and-drop mapping with visual connecting lines
 * - Sample data preview from database
 * - AI-powered automapping suggestions
 * - Support for both import and export mappings
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  ArrowLeftRight,
  Trash2,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Settings,
  X,
  Plus,
  Edit,
  RefreshCw,
  Database,
  FileJson,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  GripVertical,
  Copy,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

// ============================================
// Types & Interfaces
// ============================================

export type MappingDirection = 'import' | 'export';

export interface FieldDefinition {
  name: string;
  label: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'json';
  required: boolean;
  description?: string;
}

export interface FieldMapping {
  id: string;
  sourceField: string;
  destinationField: string;
  dataType: string;
  transformType: string;
  transformParams?: Record<string, unknown>;
}

export interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  direction: MappingDirection;
  entity: string;
  endpointId?: string;
  endpointName?: string;
  mappingCount: number;
  isActive: boolean;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
  createdAt: string;
}

export interface MappingTemplate {
  id: string;
  name: string;
  description?: string;
  entity: string;
  mappings: FieldMapping[];
}

// ============================================
// Entity Field Definitions
// ============================================

const ENTITY_FIELDS: Record<string, FieldDefinition[]> = {
  PFA: [
    { name: 'pfaId', label: 'PFA ID', dataType: 'string', required: true },
    { name: 'areaSilo', label: 'Area/Silo', dataType: 'string', required: true },
    { name: 'category', label: 'Category', dataType: 'string', required: true },
    { name: 'forecastCategory', label: 'Forecast Category', dataType: 'string', required: false },
    { name: 'class', label: 'Class', dataType: 'string', required: true },
    { name: 'source', label: 'Source (Rental/Purchase)', dataType: 'string', required: true },
    { name: 'dor', label: 'DOR (BEO/PROJECT)', dataType: 'string', required: true },
    { name: 'isActualized', label: 'Is Actualized', dataType: 'boolean', required: false },
    { name: 'isDiscontinued', label: 'Is Discontinued', dataType: 'boolean', required: false },
    { name: 'isFundsTransferable', label: 'Funds Transferable', dataType: 'boolean', required: false },
    { name: 'monthlyRate', label: 'Monthly Rate', dataType: 'number', required: false },
    { name: 'purchasePrice', label: 'Purchase Price', dataType: 'number', required: false },
    { name: 'manufacturer', label: 'Manufacturer', dataType: 'string', required: false },
    { name: 'model', label: 'Model', dataType: 'string', required: false },
    { name: 'contract', label: 'Contract', dataType: 'string', required: false },
    { name: 'equipment', label: 'Equipment Tag', dataType: 'string', required: false },
    { name: 'originalStart', label: 'Original Start Date', dataType: 'date', required: true },
    { name: 'originalEnd', label: 'Original End Date', dataType: 'date', required: true },
    { name: 'forecastStart', label: 'Forecast Start Date', dataType: 'date', required: true },
    { name: 'forecastEnd', label: 'Forecast End Date', dataType: 'date', required: true },
    { name: 'actualStart', label: 'Actual Start Date', dataType: 'date', required: false },
    { name: 'actualEnd', label: 'Actual End Date', dataType: 'date', required: false },
    { name: 'pemsVersion', label: 'PEMS Version', dataType: 'string', required: false }
  ],
  Asset: [
    { name: 'assetCode', label: 'Asset Code', dataType: 'string', required: true },
    { name: 'class', label: 'Class', dataType: 'string', required: false },
    { name: 'category', label: 'Category', dataType: 'string', required: false },
    { name: 'equipmentStatus', label: 'Equipment Status', dataType: 'string', required: false },
    { name: 'alias', label: 'Alias', dataType: 'string', required: false },
    { name: 'description', label: 'Description', dataType: 'string', required: false },
    { name: 'department', label: 'Department', dataType: 'string', required: false },
    { name: 'commissionDate', label: 'Commission Date', dataType: 'date', required: false },
    { name: 'outOfService', label: 'Out of Service', dataType: 'boolean', required: false },
    { name: 'assignedTo', label: 'Assigned To', dataType: 'string', required: false },
    { name: 'owner', label: 'Owner', dataType: 'string', required: false },
    { name: 'source', label: 'Source', dataType: 'string', required: false },
    { name: 'serialNumber', label: 'Serial Number', dataType: 'string', required: false },
    { name: 'manufacturer', label: 'Manufacturer', dataType: 'string', required: false },
    { name: 'model', label: 'Model', dataType: 'string', required: false },
    { name: 'vendor', label: 'Vendor', dataType: 'string', required: false },
    { name: 'purchaseCostOrVendorRate', label: 'Purchase Cost/Rate', dataType: 'number', required: false }
  ],
  BEO: [
    { name: 'beoId', label: 'BEO ID', dataType: 'string', required: true },
    { name: 'name', label: 'Name', dataType: 'string', required: true },
    { name: 'description', label: 'Description', dataType: 'string', required: false },
    { name: 'category', label: 'Category', dataType: 'string', required: false },
    { name: 'status', label: 'Status', dataType: 'string', required: false },
    { name: 'budget', label: 'Budget', dataType: 'number', required: false },
    { name: 'startDate', label: 'Start Date', dataType: 'date', required: false },
    { name: 'endDate', label: 'End Date', dataType: 'date', required: false }
  ]
};

const TRANSFORM_TYPES = [
  { value: 'direct', label: 'Direct Copy', hasParams: false },
  { value: 'uppercase', label: 'Uppercase', hasParams: false },
  { value: 'lowercase', label: 'Lowercase', hasParams: false },
  { value: 'trim', label: 'Trim Whitespace', hasParams: false },
  { value: 'equals_y', label: 'Y/N to Boolean', hasParams: false },
  { value: 'date_format', label: 'Date Format', hasParams: true },
  { value: 'date_parse', label: 'Parse Date String', hasParams: true },
  { value: 'multiply', label: 'Multiply', hasParams: true },
  { value: 'divide', label: 'Divide', hasParams: true },
  { value: 'round', label: 'Round Number', hasParams: true },
  { value: 'substring', label: 'Substring', hasParams: true },
  { value: 'replace', label: 'Replace Text', hasParams: true },
  { value: 'default', label: 'Default Value', hasParams: true }
];

// ============================================
// Sub-Components
// ============================================

// Transform Parameters Modal
const TransformParamsModal: React.FC<{
  isOpen: boolean;
  mapping: FieldMapping | null;
  onClose: () => void;
  onSave: (params: Record<string, unknown>) => void;
}> = ({ isOpen, mapping, onClose, onSave }) => {
  const [params, setParams] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (mapping?.transformParams) {
      setParams(mapping.transformParams);
    } else {
      setParams({});
    }
  }, [mapping]);

  if (!isOpen || !mapping) return null;

  const renderParamsFields = () => {
    switch (mapping.transformType) {
      case 'multiply':
      case 'divide':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              {mapping.transformType === 'multiply' ? 'Multiplier' : 'Divisor'}
            </label>
            <input
              type="number"
              step="any"
              value={(params.factor as number) || (params.divisor as number) || ''}
              onChange={(e) => setParams({
                [mapping.transformType === 'multiply' ? 'factor' : 'divisor']: parseFloat(e.target.value)
              })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="e.g., 30.44"
            />
          </div>
        );
      case 'round':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Decimal Places</label>
            <input
              type="number"
              min="0"
              max="10"
              value={(params.decimals as number) ?? 2}
              onChange={(e) => setParams({ decimals: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        );
      case 'date_format':
      case 'date_parse':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Format String</label>
            <input
              type="text"
              value={(params.format as string) || ''}
              onChange={(e) => setParams({ format: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="e.g., yyyy-MM-dd"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              yyyy=year, MM=month, dd=day, HH=hour, mm=minute, ss=second
            </p>
          </div>
        );
      case 'substring':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Start Index</label>
              <input
                type="number"
                min="0"
                value={(params.start as number) ?? 0}
                onChange={(e) => setParams({ ...params, start: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Length (optional)</label>
              <input
                type="number"
                min="1"
                value={(params.length as number) || ''}
                onChange={(e) => setParams({ ...params, length: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Leave empty for rest of string"
              />
            </div>
          </div>
        );
      case 'replace':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Search For</label>
              <input
                type="text"
                value={(params.search as string) || ''}
                onChange={(e) => setParams({ ...params, search: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Replace With</label>
              <input
                type="text"
                value={(params.replace as string) || ''}
                onChange={(e) => setParams({ ...params, replace: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        );
      case 'default':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Default Value</label>
            <input
              type="text"
              value={(params.defaultValue as string) || ''}
              onChange={(e) => setParams({ defaultValue: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        );
      default:
        return <p className="text-sm text-slate-500 dark:text-slate-400">No parameters required</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Transform Parameters</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
            <strong>{mapping.sourceField}</strong> → <strong>{mapping.destinationField}</strong>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transform: {TRANSFORM_TYPES.find(t => t.value === mapping.transformType)?.label}
          </p>
        </div>

        <div className="mb-6">{renderParamsFields()}</div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(params);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Parameters
          </button>
        </div>
      </div>
    </div>
  );
};

// Draggable source field
const SourceField: React.FC<{
  name: string;
  label?: string;
  sampleValue?: string;
  isUsed: boolean;
  onRefChange: (el: HTMLDivElement | null) => void;
}> = ({ name, label, sampleValue, isUsed, onRefChange }) => {
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
        ${isUsed
          ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300'
          : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-blue-400 text-slate-700 dark:text-slate-200'}
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
      data-source-field={name}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-3 h-3 text-slate-400" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-mono block truncate">{name}</span>
          {label && label !== name && (
            <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">{label}</span>
          )}
        </div>
        {isUsed && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
      </div>
      {sampleValue !== undefined && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate font-mono bg-slate-50 dark:bg-slate-800 px-1 rounded">
          {String(sampleValue).substring(0, 30)}{String(sampleValue).length > 30 ? '...' : ''}
        </div>
      )}
    </div>
  );
};

// Droppable destination field
const DestinationField: React.FC<{
  field: FieldDefinition;
  mapping?: FieldMapping;
  sampleValue?: unknown;
  onRemove: () => void;
  onTransformChange: (transformType: string) => void;
  onParamsClick: () => void;
  onRefChange: (el: HTMLDivElement | null) => void;
}> = ({ field, mapping, sampleValue, onRemove, onTransformChange, onParamsClick, onRefChange }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `dest-${field.name}`,
    data: { destinationField: field.name, dataType: field.dataType }
  });

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    onRefChange(node);
  }, [setNodeRef, onRefChange]);

  const transformHasParams = TRANSFORM_TYPES.find(t => t.value === mapping?.transformType)?.hasParams;

  return (
    <div
      ref={combinedRef}
      className={`
        px-3 py-2 rounded border transition-all
        ${mapping
          ? 'bg-green-50 dark:bg-green-500/20 border-green-300 dark:border-green-500'
          : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}
        ${isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20' : ''}
        ${field.required && !mapping ? 'border-l-4 border-l-orange-400' : ''}
      `}
      data-dest-field={field.name}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{field.label}</span>
            {field.required && <span className="text-xs text-orange-500">*</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{field.name}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">({field.dataType})</span>
          </div>
          {mapping && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-green-600 dark:text-green-400 font-mono">← {mapping.sourceField}</span>
              <select
                value={mapping.transformType}
                onChange={(e) => onTransformChange(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                {TRANSFORM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {transformHasParams && (
                <button
                  onClick={onParamsClick}
                  className="p-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                  title="Configure parameters"
                >
                  <Settings className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          {sampleValue !== undefined && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate font-mono bg-slate-50 dark:bg-slate-800 px-1 rounded">
              {String(sampleValue).substring(0, 30)}{String(sampleValue).length > 30 ? '...' : ''}
            </div>
          )}
        </div>
        {mapping && (
          <button
            onClick={onRemove}
            className="ml-2 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// SVG mapping lines with collision detection
const MappingLines: React.FC<{
  mappings: FieldMapping[];
  sourceRefs: Map<string, DOMRect>;
  destRefs: Map<string, DOMRect>;
  containerRect: DOMRect | null;
}> = ({ mappings, sourceRefs, destRefs, containerRect }) => {
  if (!containerRect) return null;

  const lineData = mappings.map((mapping) => {
    const sourceRect = sourceRefs.get(mapping.sourceField);
    const destRect = destRefs.get(mapping.destinationField);
    if (!sourceRect || !destRect) return null;

    const x1 = sourceRect.right - containerRect.left;
    const y1 = sourceRect.top - containerRect.top + sourceRect.height / 2;
    const x2 = destRect.left - containerRect.left;
    const y2 = destRect.top - containerRect.top + destRect.height / 2;

    return { mapping, x1, y1, x2, y2 };
  }).filter(Boolean) as Array<{ mapping: FieldMapping; x1: number; y1: number; x2: number; y2: number }>;

  const linesWithOffsets = lineData.map((line, idx) => {
    let yOffset = 0;
    for (let i = 0; i < idx; i++) {
      const prevLine = lineData[i];
      const midY = (line.y1 + line.y2) / 2;
      const prevMidY = (prevLine.y1 + prevLine.y2) / 2;
      if (Math.abs(midY - prevMidY) < 20) {
        yOffset += 10;
      }
    }
    return { ...line, yOffset };
  });

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {linesWithOffsets.map(({ mapping, x1, y1, x2, y2, yOffset }) => {
        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${y1 + yOffset} Q ${midX} ${y1 + yOffset}, ${midX} ${((y1 + y2) / 2) + yOffset} Q ${midX} ${y2 + yOffset}, ${x2} ${y2 + yOffset}`;

        return (
          <g key={mapping.id}>
            <path d={path} fill="none" stroke="rgb(148 163 184)" strokeWidth="3" opacity="0.3" />
            <path
              d={path}
              fill="none"
              stroke="rgb(59 130 246)"
              strokeWidth="2"
              strokeDasharray={mapping.transformType !== 'direct' ? '5,5' : '0'}
            />
            <polygon
              points={`${x2},${y2 + yOffset} ${x2-8},${y2 + yOffset - 4} ${x2-8},${y2 + yOffset + 4}`}
              fill="rgb(59 130 246)"
            />
          </g>
        );
      })}
    </svg>
  );
};

// ============================================
// Create/Edit Mapping Modal
// ============================================

interface MappingEditorModalProps {
  isOpen: boolean;
  configuration: MappingConfiguration | null;
  organizationId?: string;
  onClose: () => void;
  onSave: () => void;
}

const MappingEditorModal: React.FC<MappingEditorModalProps> = ({
  isOpen,
  configuration,
  organizationId,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [direction, setDirection] = useState<MappingDirection>('import');
  const [entity, setEntity] = useState('PFA');
  const [endpointId, setEndpointId] = useState<string>('');
  const [endpoints, setEndpoints] = useState<Array<{ id: string; name: string; entity: string; serverName: string }>>([]);
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, unknown>>({});
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<FieldMapping | null>(null);
  const [automapping, setAutomapping] = useState(false);

  // Refs for SVG lines
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const sourceRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const destRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [sourceRects, setSourceRects] = useState<Map<string, DOMRect>>(new Map());
  const [destRects, setDestRects] = useState<Map<string, DOMRect>>(new Map());
  const updateRectsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const destinationFields = ENTITY_FIELDS[entity] || ENTITY_FIELDS.PFA;

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

  const scheduleUpdateRects = useCallback(() => {
    if (updateRectsTimeoutRef.current) {
      clearTimeout(updateRectsTimeoutRef.current);
    }
    updateRectsTimeoutRef.current = setTimeout(updateRects, 50);
  }, [updateRects]);

  useEffect(() => {
    if (!isOpen) return;

    updateRects();
    window.addEventListener('resize', updateRects);
    return () => {
      window.removeEventListener('resize', updateRects);
      if (updateRectsTimeoutRef.current) {
        clearTimeout(updateRectsTimeoutRef.current);
      }
    };
  }, [isOpen, updateRects, mappings, sourceFields]);

  // Initialize from configuration
  useEffect(() => {
    if (configuration) {
      setName(configuration.name);
      setDescription(configuration.description || '');
      setDirection(configuration.direction);
      setEntity(configuration.entity);
      setEndpointId(configuration.endpointId || '');
      fetchExistingMappings(configuration.id);
    } else {
      setName('');
      setDescription('');
      setDirection('import');
      setEntity('PFA');
      setEndpointId('');
      setMappings([]);
    }
  }, [configuration]);

  // Fetch endpoints
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const params = organizationId ? { organizationId } : undefined;
        const data = await apiClient.get<{ success: boolean; endpoints: Array<{ id: string; name: string; entity: string; serverName?: string }> }>('/api/api-endpoints', params);
        setEndpoints(data.endpoints?.map(ep => ({ ...ep, serverName: ep.serverName || 'Global' })) || []);
      } catch (err) {
        console.error('Failed to fetch endpoints:', err);
      }
    };
    if (isOpen) fetchEndpoints();
  }, [isOpen, organizationId]);

  // Fetch source fields when endpoint changes
  useEffect(() => {
    if (!endpointId || direction !== 'import') {
      setSourceFields([]);
      setSampleData({});
      return;
    }

    const fetchSourceFields = async () => {
      setLoading(true);
      try {
        const params = organizationId ? { organizationId } : undefined;
        const data = await apiClient.get<{ success: boolean; fields: string[]; sample?: Record<string, unknown> }>(
          `/api/bronze/preview/${endpointId}`,
          params
        );
        setSourceFields(data.fields || []);
        setSampleData(data.sample || {});
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch source fields';
        if (message.includes('404') || message.includes('No synced data')) {
          setError('No Bronze data found for this endpoint. Run ingestion first.');
        } else {
          setError(message);
        }
        setSourceFields([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSourceFields();
  }, [endpointId, direction, organizationId]);

  // For export direction, use internal fields as source
  useEffect(() => {
    if (direction === 'export') {
      const internalFields = destinationFields.map(f => f.name);
      setSourceFields(internalFields);
    }
  }, [direction, destinationFields]);

  const fetchExistingMappings = async (configId: string) => {
    try {
      const data = await apiClient.get<{ success: boolean; mappings: FieldMapping[] }>(`/api/mapping-configurations/${configId}/mappings`);
      if (data.success && data.mappings) {
        setMappings(data.mappings);
      }
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    }
  };

  const handleSourceRefChange = useCallback((field: string, el: HTMLDivElement | null) => {
    if (el) sourceRefsMap.current.set(field, el);
    else sourceRefsMap.current.delete(field);
    scheduleUpdateRects();
  }, [scheduleUpdateRects]);

  const handleDestRefChange = useCallback((field: string, el: HTMLDivElement | null) => {
    if (el) destRefsMap.current.set(field, el);
    else destRefsMap.current.delete(field);
    scheduleUpdateRects();
  }, [scheduleUpdateRects]);

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

    const updated = [...filtered, newMapping];
    setMappings(updated);
    validateMappings(updated);
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
      m.destinationField === destinationField ? { ...m, transformType } : m
    ));
  };

  const handleParamsClick = (mapping: FieldMapping) => {
    setSelectedMapping(mapping);
    setParamsModalOpen(true);
  };

  const handleParamsSave = (params: Record<string, unknown>) => {
    if (!selectedMapping) return;
    setMappings(mappings.map(m =>
      m.destinationField === selectedMapping.destinationField
        ? { ...m, transformParams: params }
        : m
    ));
  };

  const validateMappings = (currentMappings: FieldMapping[]) => {
    const mappedDestFields = new Set(currentMappings.map(m => m.destinationField));
    const unmappedRequired = destinationFields
      .filter(f => f.required && !mappedDestFields.has(f.name))
      .map(f => f.label);
    setValidationErrors(unmappedRequired);
  };

  // AI Automapping
  const handleAutomap = async () => {
    if (sourceFields.length === 0) return;

    setAutomapping(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        success: boolean;
        suggestions: Array<{ source: string; destination: string; confidence: number }>;
        message?: string;
      }>('/api/ai/automap', {
        sourceFields,
        destinationFields: destinationFields.map(f => ({ name: f.name, label: f.label, dataType: f.dataType })),
        entity,
        sampleData
      });

      if (response.success && response.suggestions) {
        const newMappings: FieldMapping[] = response.suggestions
          .filter(s => s.confidence > 0.5)
          .map(s => ({
            id: `${s.source}-${s.destination}`,
            sourceField: s.source,
            destinationField: s.destination,
            dataType: destinationFields.find(f => f.name === s.destination)?.dataType || 'string',
            transformType: 'direct'
          }));

        setMappings(newMappings);
        validateMappings(newMappings);
        setTimeout(updateRects, 50);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI automapping failed';
      setError(message);
    } finally {
      setAutomapping(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (validationErrors.length > 0) {
      setError(`Required fields unmapped: ${validationErrors.join(', ')}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name,
        description,
        direction,
        entity,
        endpointId: endpointId || null,
        organizationId,
        mappings
      };

      if (configuration) {
        await apiClient.put(`/api/mapping-configurations/${configuration.id}`, payload);
      } else {
        await apiClient.post('/api/mapping-configurations', payload);
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save mapping configuration';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all mappings?')) {
      setMappings([]);
      setValidationErrors([]);
    }
  };

  if (!isOpen) return null;

  const usedSourceFields = new Set(mappings.map(m => m.sourceField));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="w-6 h-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {configuration ? 'Edit Mapping Configuration' : 'New Mapping Configuration'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Drag source fields to destination fields to create mappings
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Configuration Form */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., PEMS PFA Import"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as MappingDirection)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="import">Import (External → Internal)</option>
                <option value="export">Export (Internal → External)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Entity</label>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {Object.keys(ENTITY_FIELDS).map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                {direction === 'import' ? 'Source Endpoint' : 'Target Format'}
              </label>
              {direction === 'import' ? (
                <select
                  value={endpointId}
                  onChange={(e) => setEndpointId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Select Endpoint --</option>
                  {endpoints.map(ep => (
                    <option key={ep.id} value={ep.id}>
                      {ep.serverName}: {ep.name} ({ep.entity})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={endpointId}
                  onChange={(e) => setEndpointId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">CSV Export</option>
                  <option value="json">JSON Export</option>
                  <option value="excel">Excel Export</option>
                </select>
              )}
            </div>
          </div>

          {/* Validation Warnings */}
          {validationErrors.length > 0 && (
            <div className="mt-4 px-3 py-2 bg-orange-50 dark:bg-orange-500/20 border border-orange-200 dark:border-orange-500/40 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Required fields unmapped ({validationErrors.length})</div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">{validationErrors.join(', ')}</div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 px-3 py-2 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}
        </div>

        {/* Mapping Area */}
        <div className="flex-1 overflow-hidden">
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
            <div ref={containerRef} className="h-full overflow-auto px-6 py-4 relative bg-slate-50 dark:bg-slate-900">
              <MappingLines
                mappings={mappings}
                sourceRefs={sourceRects}
                destRefs={destRects}
                containerRect={containerRect}
              />

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : sourceFields.length === 0 && direction === 'import' ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
                  <Database className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No Source Fields Available</p>
                  <p className="text-sm mt-2">
                    {endpointId
                      ? 'Run data ingestion to populate source fields from the Bronze layer'
                      : 'Select an endpoint to load source fields'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8 relative" style={{ zIndex: 2 }}>
                  {/* Source Fields Column */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {direction === 'import' ? (
                          <ArrowDownToLine className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Database className="w-4 h-4 text-blue-500" />
                        )}
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {direction === 'import' ? 'Source Fields (External)' : 'Source Fields (Internal)'}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {sourceFields.length} fields
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                      {sourceFields.map(field => (
                        <SourceField
                          key={field}
                          name={field}
                          sampleValue={sampleData[field] !== undefined ? String(sampleData[field]) : undefined}
                          isUsed={usedSourceFields.has(field)}
                          onRefChange={(el) => handleSourceRefChange(field, el)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Destination Fields Column */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {direction === 'import' ? (
                          <Database className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowUpFromLine className="w-4 h-4 text-green-500" />
                        )}
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {direction === 'import' ? `Destination Fields (${entity})` : 'Destination Fields (Export)'}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {destinationFields.length} fields
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                      {destinationFields.map(field => {
                        const mapping = mappings.find(m => m.destinationField === field.name);
                        return (
                          <DestinationField
                            key={field.name}
                            field={field}
                            mapping={mapping}
                            onRemove={() => handleRemoveMapping(field.name)}
                            onTransformChange={(type) => handleTransformChange(field.name, type)}
                            onParamsClick={() => mapping && handleParamsClick(mapping)}
                            onRefChange={(el) => handleDestRefChange(field.name, el)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DragOverlay>
              {activeId ? (
                <div className="px-3 py-2 bg-blue-600 border border-blue-400 rounded shadow-lg text-white">
                  <span className="text-xs font-mono">{activeId.replace('source-', '')}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleAutomap}
              disabled={sourceFields.length === 0 || automapping}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Use AI to suggest field mappings"
            >
              {automapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Automap
            </button>
            <button
              onClick={handleReset}
              disabled={mappings.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Transform Params Modal */}
        <TransformParamsModal
          isOpen={paramsModalOpen}
          mapping={selectedMapping}
          onClose={() => setParamsModalOpen(false)}
          onSave={handleParamsSave}
        />
      </div>
    </div>
  );
};

// ============================================
// Main MappingStudio Component
// ============================================

interface MappingStudioProps {
  organizationId?: string;
  onConfigurationSelect?: (config: MappingConfiguration) => void;
}

export const MappingStudio: React.FC<MappingStudioProps> = ({
  organizationId,
  onConfigurationSelect
}) => {
  const [configurations, setConfigurations] = useState<MappingConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<MappingConfiguration | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'import' | 'export'>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadConfigurations();
  }, [organizationId]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const params = organizationId ? { organizationId } : undefined;
      const data = await apiClient.get<{ success: boolean; configurations: MappingConfiguration[] }>(
        '/api/mapping-configurations',
        params
      );
      setConfigurations(data.configurations || []);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load configurations';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (config: MappingConfiguration) => {
    if (!confirm(`Delete mapping configuration "${config.name}"?`)) return;

    try {
      await apiClient.delete(`/api/mapping-configurations/${config.id}`);
      await loadConfigurations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete configuration';
      alert(message);
    }
  };

  const handleDuplicate = async (config: MappingConfiguration) => {
    try {
      await apiClient.post(`/api/mapping-configurations/${config.id}/duplicate`, {});
      await loadConfigurations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate configuration';
      alert(message);
    }
  };

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredConfigs = configurations.filter(c => {
    if (filter !== 'all' && c.direction !== filter) return false;
    if (entityFilter !== 'all' && c.entity !== entityFilter) return false;
    return true;
  });

  const uniqueEntities = Array.from(new Set(configurations.map(c => c.entity)));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mapping Studio</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure field mappings for data import and export operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Mapping
          </button>
          <button
            onClick={loadConfigurations}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            <span className="font-semibold">
              Total: <span className="text-blue-500">{configurations.length}</span>
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ArrowDownToLine className="w-4 h-4 text-green-500" />
            <span className="font-semibold">
              Import: <span className="text-green-500">{configurations.filter(c => c.direction === 'import').length}</span>
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ArrowUpFromLine className="w-4 h-4 text-orange-500" />
            <span className="font-semibold">
              Export: <span className="text-orange-500">{configurations.filter(c => c.direction === 'export').length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Direction:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'import' | 'export')}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          >
            <option value="all">All</option>
            <option value="import">Import Only</option>
            <option value="export">Export Only</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Entity:</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          >
            <option value="all">All Entities</option>
            {uniqueEntities.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Configurations Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="w-8"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Configuration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Mappings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Modified
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredConfigs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <FileJson className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No mapping configurations found</p>
                    <p className="text-sm mt-2">Click "Add Mapping" to create your first configuration</p>
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((config) => (
                  <tr
                    key={config.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    onDoubleClick={() => setSelectedConfig(config)}
                    title="Double-click to edit"
                  >
                    <td className="px-2">
                      <button
                        onClick={() => toggleRowExpanded(config.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {expandedRows.has(config.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{config.name}</div>
                        {config.description && (
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{config.description}</div>
                        )}
                        {config.endpointName && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Endpoint: {config.endpointName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        config.direction === 'import'
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                          : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                      }`}>
                        {config.direction === 'import' ? (
                          <ArrowDownToLine className="w-3 h-3" />
                        ) : (
                          <ArrowUpFromLine className="w-3 h-3" />
                        )}
                        {config.direction.charAt(0).toUpperCase() + config.direction.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                        <Database className="w-3 h-3" />
                        {config.entity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {config.mappingCount} fields
                    </td>
                    <td className="px-6 py-4">
                      {config.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {formatDate(config.lastModifiedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedConfig(config)}
                          className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded transition-colors"
                          title="Edit Configuration"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(config)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded transition-colors"
                          title="Duplicate Configuration"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(config)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded transition-colors"
                          title="Delete Configuration"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <MappingEditorModal
        isOpen={showCreateModal || selectedConfig !== null}
        configuration={selectedConfig}
        organizationId={organizationId}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedConfig(null);
        }}
        onSave={() => {
          loadConfigurations();
          if (onConfigurationSelect && selectedConfig) {
            onConfigurationSelect(selectedConfig);
          }
        }}
      />
    </div>
  );
};

// Legacy export for backward compatibility
export const MappingStudioComplete = MappingStudio;

export default MappingStudio;
