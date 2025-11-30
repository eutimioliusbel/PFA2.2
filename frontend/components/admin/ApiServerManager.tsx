/**
 * @file ApiServerManager.tsx
 * @description Two-tier API architecture management UI (Server → Endpoint)
 * Implements optimistic updates, per-endpoint testing, and health visualization
 * Refactored with React Query for ADR-007 compliance
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Play,
  Eye,
  EyeOff,
  Shield,
  GitCompare,
  Download,
  Loader2
} from 'lucide-react';
import ServerFormModal from './ServerFormModal';
import EndpointFormModal from './EndpointFormModal';
import { PromotionRulesEditor } from './PromotionRulesEditor';
import { SchemaDiffModal } from './SchemaDiffModal';
import { apiClient } from '../../services/apiClient';
import ErrorBoundary from '../ErrorBoundary';

interface ApiServer {
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  authType: string;
  hasCredentials: boolean;
  healthStatus: string;
  healthScore: number;
  totalEndpoints: number;
  healthyEndpoints: number;
  degradedEndpoints: number;
  downEndpoints: number;
  status: string;
  isActive: boolean;
  endpoints: ApiEndpoint[];
  createdAt: string;
  updatedAt: string;
}

interface ApiEndpoint {
  id: string;
  serverId: string;
  name: string;
  path: string;
  description?: string;
  entity: string;
  operationType: string;
  status: string;
  firstTestedAt?: string;
  lastTestedAt?: string;
  testCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs?: number;
  lastErrorMessage?: string;
  lastStatusCode?: number;
  isActive: boolean;
  // Usage tracking
  firstUsedAt?: string;
  lastUsedAt?: string;
  lastUsedRecordCount?: number;
  totalRecordsSinceFirstUse: number;
  // Refresh configuration
  refreshFrequencyMinutes?: number;
  lastRefreshAt?: string;
  nextScheduledRefreshAt?: string;
  autoRefreshEnabled: boolean;
  // Promotion rules (ADR-007 Task 6.2)
  promotionRules?: any;
}

interface ApiServerManagerProps {
  organizationId: string;
}

const ApiServerManagerComponent: React.FC<ApiServerManagerProps> = ({ organizationId }) => {
  const queryClient = useQueryClient();
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [_showCredentials, _setShowCredentials] = useState<Set<string>>(new Set());

  // Modal states
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [isAddingEndpoint, setIsAddingEndpoint] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<ApiServer | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<ApiEndpoint | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Map<string, any>>(new Map());
  const [serverTestResults, setServerTestResults] = useState<Map<string, any>>(new Map());
  const [showPromotionRules, setShowPromotionRules] = useState(false);
  const [selectedEndpointForRules, setSelectedEndpointForRules] = useState<ApiEndpoint | null>(null);
  const [showSchemaDrift, setShowSchemaDrift] = useState(false);
  const [selectedEndpointForSchemaDrift, setSelectedEndpointForSchemaDrift] = useState<ApiEndpoint | null>(null);

  // Fetch servers with React Query
  const { data: serversData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['servers', organizationId],
    queryFn: async ({ signal: _signal }) => {
      const response = await apiClient.get<{ data: ApiServer[] }>('/api/servers');
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const servers = serversData || [];
  const error = queryError ? (queryError as Error).message : null;

  const toggleServer = (serverId: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  // Test endpoint mutation
  const testEndpointMutation = useMutation({
    mutationFn: async (endpointId: string) => {
      return apiClient.post<{ data: any }>(`/api/endpoints/${endpointId}/test`, {
        organizationId: organizationId
      });
    },
    onMutate: async (endpointId) => {
      setTestingEndpoint(endpointId);
      setTestResults(prev => new Map(prev).set(endpointId, { status: 'testing' }));
    },
    onSuccess: (result, endpointId) => {
      setTestResults(prev => new Map(prev).set(endpointId, result.data));
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
    },
    onError: (error: Error, endpointId) => {
      setTestResults(prev => new Map(prev).set(endpointId, {
        status: 'error',
        error: error.message
      }));
    },
    onSettled: () => {
      setTestingEndpoint(null);
    }
  });

  const testEndpoint = (endpointId: string) => {
    testEndpointMutation.mutate(endpointId);
  };

  // Sync endpoint state
  const [syncingEndpoint, setSyncingEndpoint] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Map<string, any>>(new Map());

  // Sync endpoint mutation
  const syncEndpointMutation = useMutation({
    mutationFn: async ({ endpointId, serverId }: { endpointId: string; serverId: string }) => {
      return apiClient.post<{ data: any }>(`/api/endpoints/${endpointId}/sync`, {
        serverId,
        organizationId,
        syncType: 'full'
      });
    },
    onMutate: async ({ endpointId }) => {
      setSyncingEndpoint(endpointId);
      setSyncResults(prev => new Map(prev).set(endpointId, { status: 'syncing' }));
    },
    onSuccess: (result, { endpointId }) => {
      setSyncResults(prev => new Map(prev).set(endpointId, {
        status: 'success',
        data: result.data
      }));
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
    },
    onError: (error: Error, { endpointId }) => {
      setSyncResults(prev => new Map(prev).set(endpointId, {
        status: 'error',
        error: error.message
      }));
    },
    onSettled: () => {
      setSyncingEndpoint(null);
    }
  });

  const syncEndpoint = (endpointId: string, serverId: string) => {
    syncEndpointMutation.mutate({ endpointId, serverId });
  };

  // Test all endpoints mutation
  const testAllEndpointsMutation = useMutation({
    mutationFn: async (serverId: string) => {
      return apiClient.post<{ data: any }>(`/api/servers/${serverId}/test`, {});
    },
    onMutate: async (serverId) => {
      setServerTestResults(prev => new Map(prev).set(serverId, { status: 'testing' }));
    },
    onSuccess: (result, serverId) => {
      setServerTestResults(prev => new Map(prev).set(serverId, {
        status: 'success',
        data: result.data
      }));
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
    },
    onError: (error: Error, serverId) => {
      setServerTestResults(prev => new Map(prev).set(serverId, {
        status: 'error',
        error: error.message
      }));
    }
  });

  const testAllEndpoints = (serverId: string) => {
    testAllEndpointsMutation.mutate(serverId);
  };

  // Delete server mutation with optimistic update
  const deleteServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      return apiClient.delete(`/api/servers/${serverId}`);
    },
    onMutate: async (serverId) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['servers', organizationId] });

      // Snapshot previous value
      const previousServers = queryClient.getQueryData<ApiServer[]>(['servers', organizationId]);

      // Optimistically update
      queryClient.setQueryData<ApiServer[]>(['servers', organizationId], (old) =>
        old ? old.filter(s => s.id !== serverId) : []
      );

      return { previousServers };
    },
    onError: (_err, _serverId, context) => {
      // Rollback on error
      if (context?.previousServers) {
        queryClient.setQueryData(['servers', organizationId], context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
    }
  });

  const deleteServer = (serverId: string) => {
    if (!confirm('Delete this server and all its endpoints? This cannot be undone.')) {
      return;
    }
    deleteServerMutation.mutate(serverId);
  };

  // Delete endpoint mutation with optimistic update
  const deleteEndpointMutation = useMutation({
    mutationFn: async ({ endpointId, serverId }: { endpointId: string; serverId: string }) => {
      return apiClient.delete(`/api/endpoints/${endpointId}?serverId=${serverId}`);
    },
    onMutate: async ({ endpointId, serverId }) => {
      await queryClient.cancelQueries({ queryKey: ['servers', organizationId] });
      const previousServers = queryClient.getQueryData<ApiServer[]>(['servers', organizationId]);

      queryClient.setQueryData<ApiServer[]>(['servers', organizationId], (old) =>
        old ? old.map(s =>
          s.id === serverId
            ? { ...s, endpoints: s.endpoints.filter(e => e.id !== endpointId) }
            : s
        ) : []
      );

      return { previousServers };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(['servers', organizationId], context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
    }
  });

  const deleteEndpoint = (endpointId: string, serverId: string) => {
    if (!confirm('Delete this endpoint? This cannot be undone.')) {
      return;
    }
    deleteEndpointMutation.mutate({ endpointId, serverId });
  };

  // Toggle endpoint activation mutation
  const toggleEndpointMutation = useMutation({
    mutationFn: async ({ endpoint, serverId: _serverId }: { endpoint: ApiEndpoint; serverId: string }) => {
      return apiClient.put(`/api/endpoints/${endpoint.id}`, {
        isActive: !endpoint.isActive
      });
    },
    onMutate: async ({ endpoint, serverId }) => {
      await queryClient.cancelQueries({ queryKey: ['servers', organizationId] });
      const previousServers = queryClient.getQueryData<ApiServer[]>(['servers', organizationId]);

      queryClient.setQueryData<ApiServer[]>(['servers', organizationId], (old) =>
        old ? old.map(s =>
          s.id === serverId
            ? {
                ...s,
                endpoints: s.endpoints.map(e =>
                  e.id === endpoint.id ? { ...e, isActive: !e.isActive } : e
                )
              }
            : s
        ) : []
      );

      return { previousServers };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(['servers', organizationId], context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
    }
  });

  const toggleEndpointActivation = (endpoint: ApiEndpoint, serverId: string) => {
    toggleEndpointMutation.mutate({ endpoint, serverId });
  };

  // Create server mutation
  const createServerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiClient.post('/api/servers', { ...data, organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
      setIsAddingServer(false);
    }
  });

  // Update server mutation
  const updateServerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiClient.put(`/api/servers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
      setEditingServer(null);
    }
  });

  // Create endpoint mutation
  const createEndpointMutation = useMutation({
    mutationFn: async ({ serverId, data }: { serverId: string; data: any }) => {
      return apiClient.post(`/api/servers/${serverId}/endpoints`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
      setIsAddingEndpoint(null);
    }
  });

  // Update endpoint mutation
  const updateEndpointMutation = useMutation({
    mutationFn: async ({ id, serverId, data }: { id: string; serverId: string; data: any }) => {
      return apiClient.put(`/api/endpoints/${id}`, { ...data, serverId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
      setEditingEndpoint(null);
    }
  });

  // Handler functions for modals
  const handleCreateServer = async (data: any) => {
    try {
      await createServerMutation.mutateAsync(data);
    } catch (err: any) {
      throw err; // Re-throw to be handled by modal
    }
  };

  const handleUpdateServer = async (data: any) => {
    if (!editingServer) return;
    try {
      await updateServerMutation.mutateAsync({ id: editingServer.id, data });
    } catch (err: any) {
      throw err; // Re-throw to be handled by modal
    }
  };

  const handleCreateEndpoint = async (data: any) => {
    if (!isAddingEndpoint) return;
    try {
      await createEndpointMutation.mutateAsync({ serverId: isAddingEndpoint, data });
    } catch (err: any) {
      throw err; // Re-throw to be handled by modal
    }
  };

  const handleUpdateEndpoint = async (data: any) => {
    if (!editingEndpoint) return;
    try {
      await updateEndpointMutation.mutateAsync({
        id: editingEndpoint.id,
        serverId: editingEndpoint.serverId,
        data
      });
    } catch (err: any) {
      throw err; // Re-throw to be handled by modal
    }
  };

  const handleSavePromotionRules = async (endpoint: { id: string; name: string; entity: string; promotionRules?: unknown }) => {
    const fullEndpoint = selectedEndpointForRules;
    if (!fullEndpoint) return;
    try {
      await updateEndpointMutation.mutateAsync({
        id: endpoint.id,
        serverId: fullEndpoint.serverId,
        data: {
          promotionRules: endpoint.promotionRules
        }
      });
      setShowPromotionRules(false);
      setSelectedEndpointForRules(null);
    } catch (err: unknown) {
      throw err; // Re-throw to be handled by editor
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400 bg-green-500/20 border-green-500/40';
      case 'degraded':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40';
      case 'down':
        return 'text-red-400 bg-red-500/20 border-red-500/40';
      default:
        return 'text-slate-400 bg-slate-700 border-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-400">Loading API servers...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">API Servers</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage API servers and endpoints (two-tier architecture)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingServer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Server
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 text-slate-300">
          <Server className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">
            Total Servers: <span className="text-blue-400">{servers.length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Healthy: <span className="text-green-400">{servers.filter(s => s.healthStatus === 'healthy').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Degraded: <span className="text-yellow-400">{servers.filter(s => s.healthStatus === 'degraded').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Down: <span className="text-red-400">{servers.filter(s => s.healthStatus === 'down').length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Total Endpoints: <span className="text-purple-400">{servers.reduce((sum, s) => sum + s.totalEndpoints, 0)}</span>
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600">
          <Server className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-300 font-medium">No API servers configured</p>
          <p className="text-sm text-slate-400 mt-1">Add your first server to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {servers.map(server => (
            <div
              key={server.id}
              className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
            >
              {/* Server Header */}
              <div className="p-4 bg-slate-900 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <button
                      onClick={() => toggleServer(server.id)}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {expandedServers.has(server.id) ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Database className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-slate-100">{server.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getHealthColor(server.healthStatus)}`}>
                          {getHealthIcon(server.healthStatus)}
                          <span className="ml-1 capitalize">{server.healthStatus}</span>
                        </span>
                        <span className="text-sm text-slate-400">
                          Score: {server.healthScore}/100
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1 font-mono">{server.baseUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => testAllEndpoints(server.id)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Test all endpoints"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingServer(server)}
                      className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit server"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteServer(server.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete server"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Server Stats */}
                <div className="mt-3 flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-400">Total:</span>
                    <span className="font-medium text-slate-100">{server.totalEndpoints}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>{server.healthyEndpoints}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{server.degradedEndpoints}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-red-400">
                    <XCircle className="w-4 h-4" />
                    <span>{server.downEndpoints}</span>
                  </div>
                </div>

                {/* Server Test Result */}
                {serverTestResults.has(server.id) && (() => {
                  const result = serverTestResults.get(server.id);
                  if (result.status === 'testing') {
                    return (
                      <div className="mt-3 flex items-center gap-2 text-sm text-blue-400">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>Testing all endpoints...</span>
                      </div>
                    );
                  } else if (result.status === 'success') {
                    return (
                      <div className="mt-3 p-3 bg-green-500/20 border border-green-500/40 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="font-medium text-green-300">
                            Server test completed: {result.data.successfulTests}/{result.data.totalEndpoints} endpoints passed
                          </span>
                        </div>
                        {result.data.failedTests > 0 && (
                          <div className="mt-1 text-xs text-green-400">
                            {result.data.failedTests} endpoint(s) failed - check individual results below
                          </div>
                        )}
                      </div>
                    );
                  } else if (result.status === 'error') {
                    return (
                      <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="font-medium text-red-300">
                            Server test failed: {result.error}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Endpoints List (Expanded) */}
              {expandedServers.has(server.id) && (
                <div className="p-4 bg-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300">Endpoints</h4>
                    <button
                      onClick={() => setIsAddingEndpoint(server.id)}
                      className="inline-flex items-center px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Endpoint
                    </button>
                  </div>

                  {server.endpoints.length === 0 ? (
                    <div className="text-center py-8 bg-slate-900 rounded-lg">
                      <p className="text-sm text-slate-400">No endpoints configured</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Entity</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Name</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Endpoint</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Status</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">First Sync</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Last Sync</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Last Pull</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-400 uppercase text-xs">Total Records</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-400 uppercase text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {server.endpoints.map((endpoint, _index) => {
                            const testResult = testResults.get(endpoint.id);
                            const syncResult = syncResults.get(endpoint.id);
                            const isTesting = testingEndpoint === endpoint.id;
                            const isSyncing = syncingEndpoint === endpoint.id;

                            return (
                              <React.Fragment key={`endpoint-fragment-${endpoint.id}`}>
                              <tr
                                onDoubleClick={() => setEditingEndpoint(endpoint)}
                                className={`border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors ${
                                  !endpoint.isActive ? 'opacity-60' : ''
                                }`}
                              >
                                {/* Entity */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-2">
                                    <div className="p-1.5 bg-blue-500/20 rounded">
                                      <Database className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span className="text-xs font-medium text-slate-300 capitalize">{endpoint.entity}</span>
                                  </div>
                                </td>

                                {/* Name */}
                                <td className="py-3 px-4">
                                  <div>
                                    <div className="font-medium text-slate-100">{endpoint.name}</div>
                                    <div className="text-xs text-slate-400 capitalize">{endpoint.operationType}</div>
                                  </div>
                                </td>

                                {/* Endpoint/Path */}
                                <td className="py-3 px-4">
                                  <code className="text-xs text-slate-300 font-mono bg-slate-900 px-2 py-1 rounded">
                                    {endpoint.path}
                                  </code>
                                </td>

                                {/* Status */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-2">
                                    {endpoint.status === 'healthy' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/40">
                                        TESTED
                                      </span>
                                    )}
                                    {endpoint.status === 'degraded' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                                        WARNING
                                      </span>
                                    )}
                                    {endpoint.status === 'down' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40">
                                        FAILED
                                      </span>
                                    )}
                                    {endpoint.status === 'untested' && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-400 border border-slate-600">
                                        UNTESTED
                                      </span>
                                    )}
                                    {!endpoint.isActive && (
                                      <span className="text-xs text-slate-500">(Inactive)</span>
                                    )}
                                  </div>
                                </td>

                                {/* First Sync */}
                                <td className="py-3 px-4 text-slate-400 italic">
                                  {endpoint.firstUsedAt ? new Date(endpoint.firstUsedAt).toLocaleDateString() :
                                   endpoint.firstTestedAt ? new Date(endpoint.firstTestedAt).toLocaleDateString() :
                                   'Never'}
                                </td>

                                {/* Last Sync */}
                                <td className="py-3 px-4 text-slate-400 italic">
                                  {endpoint.lastUsedAt ? new Date(endpoint.lastUsedAt).toLocaleString() :
                                   endpoint.lastTestedAt ? new Date(endpoint.lastTestedAt).toLocaleString() :
                                   'Never'}
                                </td>

                                {/* Last Pull */}
                                <td className="py-3 px-4 text-slate-400">
                                  {endpoint.lastUsedRecordCount !== undefined && endpoint.lastUsedRecordCount !== null
                                    ? endpoint.lastUsedRecordCount.toLocaleString()
                                    : '—'}
                                </td>

                                {/* Total Records */}
                                <td className="py-3 px-4 text-slate-400">
                                  {endpoint.totalRecordsSinceFirstUse > 0
                                    ? endpoint.totalRecordsSinceFirstUse.toLocaleString()
                                    : '—'}
                                </td>

                                {/* Actions */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center justify-end space-x-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleEndpointActivation(endpoint, server.id); }}
                                      className={`p-1.5 rounded transition-colors ${
                                        endpoint.isActive
                                          ? 'text-green-400 hover:bg-green-500/20'
                                          : 'text-slate-500 hover:bg-slate-700'
                                      }`}
                                      title={endpoint.isActive ? 'Deactivate' : 'Activate'}
                                    >
                                      {endpoint.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); testEndpoint(endpoint.id); }}
                                      disabled={isTesting || !endpoint.isActive}
                                      className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                                      title={endpoint.isActive ? 'Test' : 'Activate to test'}
                                    >
                                      {isTesting ? (
                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); syncEndpoint(endpoint.id, server.id); }}
                                      disabled={isSyncing || !endpoint.isActive}
                                      className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded transition-colors disabled:opacity-50"
                                      title={endpoint.isActive ? 'Sync data from this endpoint' : 'Activate to sync'}
                                    >
                                      {isSyncing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Download className="w-4 h-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEndpointForRules(endpoint);
                                        setShowPromotionRules(true);
                                      }}
                                      className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded transition-colors"
                                      title="Configure Promotion Rules"
                                    >
                                      <Shield className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEndpointForSchemaDrift(endpoint);
                                        setShowSchemaDrift(true);
                                      }}
                                      className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded transition-colors"
                                      title="Schema Drift Analysis"
                                    >
                                      <GitCompare className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditingEndpoint(endpoint); }}
                                      className="p-1.5 text-slate-400 hover:bg-slate-700 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteEndpoint(endpoint.id, server.id); }}
                                      className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Endpoint Test Result Row (shown when test result available) */}
                              {testResult && testResult.status !== 'testing' && (
                                <tr className="border-b border-slate-700 bg-slate-900/50">
                                  <td colSpan={9} className="py-2 px-4">
                                    {testResult.status === 'error' ? (
                                      <div className="flex items-start gap-2 text-sm p-2 bg-red-500/20 border border-red-500/40 rounded">
                                        <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                                        <div>
                                          <div className="font-medium text-red-300">
                                            Test failed: {testResult.error}
                                          </div>
                                        </div>
                                      </div>
                                    ) : testResult.success !== undefined ? (
                                      testResult.success ? (
                                        <div className="flex items-start gap-2 text-sm p-2 bg-green-500/20 border border-green-500/40 rounded">
                                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                                          <div className="flex-1">
                                            <div className="font-medium text-green-300">
                                              Test passed
                                            </div>
                                            <div className="text-xs text-green-400 mt-1 space-x-4">
                                              {testResult.statusCode && (
                                                <span>Status: {testResult.statusCode}</span>
                                              )}
                                              {testResult.responseTimeMs !== undefined && (
                                                <span>Response time: {testResult.responseTimeMs}ms</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-2 text-sm p-2 bg-red-500/20 border border-red-500/40 rounded">
                                          <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                                          <div className="flex-1">
                                            <div className="font-medium text-red-300">
                                              Test failed
                                            </div>
                                            <div className="text-xs text-red-400 mt-1">
                                              {testResult.errorMessage && (
                                                <div>{testResult.errorMessage}</div>
                                              )}
                                              <div className="space-x-4 mt-1">
                                                {testResult.statusCode && (
                                                  <span>Status: {testResult.statusCode}</span>
                                                )}
                                                {testResult.responseTimeMs !== undefined && (
                                                  <span>Response time: {testResult.responseTimeMs}ms</span>
                                                )}
                                                {testResult.errorType && (
                                                  <span>Type: {testResult.errorType}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    ) : null}
                                  </td>
                                </tr>
                              )}

                              {/* Endpoint Sync Result Row */}
                              {syncResult && syncResult.status !== 'syncing' && (
                                <tr className="border-b border-slate-700 bg-slate-900/50">
                                  <td colSpan={9} className="py-2 px-4">
                                    {syncResult.status === 'error' ? (
                                      <div className="flex items-start gap-2 text-sm p-2 bg-red-500/20 border border-red-500/40 rounded">
                                        <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                                        <div>
                                          <div className="font-medium text-red-300">
                                            Sync failed: {syncResult.error}
                                          </div>
                                        </div>
                                      </div>
                                    ) : syncResult.status === 'success' ? (
                                      <div className="flex items-start gap-2 text-sm p-2 bg-cyan-500/20 border border-cyan-500/40 rounded">
                                        <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5" />
                                        <div className="flex-1">
                                          <div className="font-medium text-cyan-300">
                                            Sync completed
                                          </div>
                                          <div className="text-xs text-cyan-400 mt-1 space-x-4">
                                            {syncResult.data?.recordsProcessed !== undefined && (
                                              <span>Records: {syncResult.data.recordsProcessed}</span>
                                            )}
                                            {syncResult.data?.message && (
                                              <span>{syncResult.data.message}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <ServerFormModal
        isOpen={isAddingServer || !!editingServer}
        mode={isAddingServer ? 'add' : 'edit'}
        server={editingServer as any}
        onClose={() => {
          setIsAddingServer(false);
          setEditingServer(null);
        }}
        onSave={isAddingServer ? handleCreateServer : handleUpdateServer}
      />

      <EndpointFormModal
        isOpen={!!isAddingEndpoint || !!editingEndpoint}
        mode={isAddingEndpoint ? 'add' : 'edit'}
        serverId={isAddingEndpoint || editingEndpoint?.serverId || ''}
        serverName={
          isAddingEndpoint
            ? servers.find(s => s.id === isAddingEndpoint)?.name
            : editingEndpoint
            ? servers.find(s => s.id === editingEndpoint.serverId)?.name
            : undefined
        }
        endpoint={editingEndpoint as any}
        onClose={() => {
          setIsAddingEndpoint(null);
          setEditingEndpoint(null);
        }}
        onSave={isAddingEndpoint ? (handleCreateEndpoint as any) : (handleUpdateEndpoint as any)}
      />

      {/* Promotion Rules Editor Modal */}
      {showPromotionRules && selectedEndpointForRules && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <PromotionRulesEditor
                endpoint={selectedEndpointForRules}
                onSave={handleSavePromotionRules}
                onClose={() => {
                  setShowPromotionRules(false);
                  setSelectedEndpointForRules(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Schema Drift Modal */}
      {showSchemaDrift && selectedEndpointForSchemaDrift && (
        <SchemaDiffModal
          isOpen={showSchemaDrift}
          endpointId={selectedEndpointForSchemaDrift.id}
          endpointName={selectedEndpointForSchemaDrift.name}
          onClose={() => {
            setShowSchemaDrift(false);
            setSelectedEndpointForSchemaDrift(null);
          }}
          onMappingsUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['servers', organizationId] });
          }}
        />
      )}
    </div>
  );
};

// Export wrapped with Error Boundary for better error handling
export const ApiServerManager: React.FC<ApiServerManagerProps> = (props) => (
  <ErrorBoundary>
    <ApiServerManagerComponent {...props} />
  </ErrorBoundary>
);

export default ApiServerManager;

