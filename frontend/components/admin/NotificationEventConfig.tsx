/**
 * Notification Event Configuration Component
 *
 * ADR-005 Implementation: Robust Event-Based Notification System
 *
 * Features:
 * - Configure which events trigger notifications
 * - Filter by role, organization, or user
 * - Multiple delivery channels (in-app toast, email, slack, teams)
 * - Event categories (PFA changes, PEMS sync, approvals, etc.)
 *
 * Event Types:
 * - pfa.changes.submitted: PFA changes submitted for approval
 * - pfa.changes.approved: PFA changes approved
 * - pfa.changes.rejected: PFA changes rejected
 * - pfa.sync.started: PEMS sync started
 * - pfa.sync.completed: PEMS sync completed successfully
 * - pfa.sync.failed: PEMS sync failed
 * - pfa.data.refreshed: Organization data refreshed
 * - pfa.changes.reverted: Changes reverted to previous state
 * - pfa.record.created: New PFA record created
 * - pfa.record.deleted: PFA record deleted
 * - user.session.expired: User session expired
 * - approval.pending: Approval waiting for action
 * - budget.threshold.exceeded: Budget threshold exceeded
 * - schedule.delay.detected: Schedule delay detected
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Globe,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  Database,
  Shield,
  DollarSign,
  Calendar,
  Save,
} from 'lucide-react';

const API_BASE_URL =
  (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ||
  'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

interface EventCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  events: EventType[];
}

interface EventType {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  defaultChannels: string[];
  severity: 'info' | 'warning' | 'critical';
}

interface NotificationRule {
  id: string;
  eventType: string;
  scope: 'global' | 'organization' | 'role' | 'user';
  scopeId?: string;
  scopeName?: string;
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    slack: boolean;
    teams: boolean;
  };
  quietHoursOverride: boolean;
}

interface Organization {
  id: string;
  code: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// Event Categories Definition
// ============================================================================

const EVENT_CATEGORIES: EventCategory[] = [
  {
    id: 'pfa_changes',
    name: 'PFA Changes',
    description: 'Notifications related to PFA record modifications',
    icon: <Database className="w-5 h-5" />,
    events: [
      {
        id: 'pfa.changes.submitted',
        name: 'Changes Submitted for Approval',
        description: 'When a user submits PFA changes for approval',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'info',
      },
      {
        id: 'pfa.changes.approved',
        name: 'Changes Approved',
        description: 'When PFA changes are approved by a manager',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
      {
        id: 'pfa.changes.rejected',
        name: 'Changes Rejected',
        description: 'When PFA changes are rejected by a manager',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'warning',
      },
      {
        id: 'pfa.changes.reverted',
        name: 'Changes Reverted',
        description: 'When changes are reverted to a previous state',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'warning',
      },
      {
        id: 'pfa.record.created',
        name: 'New Record Created',
        description: 'When a new PFA forecast record is created',
        defaultEnabled: false,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
      {
        id: 'pfa.record.deleted',
        name: 'Record Deleted',
        description: 'When a PFA record is soft-deleted',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'warning',
      },
    ],
  },
  {
    id: 'pems_sync',
    name: 'PEMS Synchronization',
    description: 'Notifications related to PEMS data sync operations',
    icon: <RefreshCw className="w-5 h-5" />,
    events: [
      {
        id: 'pfa.sync.started',
        name: 'Sync Started',
        description: 'When a PEMS sync operation begins',
        defaultEnabled: false,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
      {
        id: 'pfa.sync.completed',
        name: 'Sync Completed',
        description: 'When PEMS sync completes successfully',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
      {
        id: 'pfa.sync.failed',
        name: 'Sync Failed',
        description: 'When PEMS sync fails with an error',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email', 'slack'],
        severity: 'critical',
      },
      {
        id: 'pfa.data.refreshed',
        name: 'Data Refreshed',
        description: 'When organization data is refreshed from source',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
    ],
  },
  {
    id: 'approvals',
    name: 'Approval Workflow',
    description: 'Notifications for the approval process',
    icon: <Shield className="w-5 h-5" />,
    events: [
      {
        id: 'approval.pending',
        name: 'Approval Pending',
        description: 'When changes are waiting for your approval',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'warning',
      },
      {
        id: 'approval.reminder',
        name: 'Approval Reminder',
        description: 'Reminder for pending approvals older than 24 hours',
        defaultEnabled: true,
        defaultChannels: ['email'],
        severity: 'warning',
      },
      {
        id: 'approval.escalated',
        name: 'Approval Escalated',
        description: 'When an approval is escalated to higher authority',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'critical',
      },
    ],
  },
  {
    id: 'budget_alerts',
    name: 'Budget & Financial',
    description: 'Notifications for budget thresholds and financial alerts',
    icon: <DollarSign className="w-5 h-5" />,
    events: [
      {
        id: 'budget.threshold.warning',
        name: 'Budget Warning (80%)',
        description: 'When forecast reaches 80% of budget',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'warning',
      },
      {
        id: 'budget.threshold.exceeded',
        name: 'Budget Exceeded',
        description: 'When forecast exceeds 100% of budget',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email', 'slack'],
        severity: 'critical',
      },
      {
        id: 'cost.variance.detected',
        name: 'Cost Variance Detected',
        description: 'When significant cost variance is detected',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'warning',
      },
    ],
  },
  {
    id: 'schedule_alerts',
    name: 'Schedule & Timeline',
    description: 'Notifications for schedule-related events',
    icon: <Calendar className="w-5 h-5" />,
    events: [
      {
        id: 'schedule.delay.detected',
        name: 'Schedule Delay Detected',
        description: 'When a schedule delay is detected',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'warning',
      },
      {
        id: 'schedule.milestone.approaching',
        name: 'Milestone Approaching',
        description: 'When a project milestone is within 7 days',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
      {
        id: 'schedule.equipment.ending',
        name: 'Equipment Rental Ending',
        description: 'When equipment rental is ending within 14 days',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'info',
      },
    ],
  },
  {
    id: 'system',
    name: 'System Events',
    description: 'System-level notifications',
    icon: <AlertTriangle className="w-5 h-5" />,
    events: [
      {
        id: 'user.session.expired',
        name: 'Session Expired',
        description: 'When user session has expired',
        defaultEnabled: true,
        defaultChannels: ['inApp'],
        severity: 'info',
      },
      {
        id: 'user.permissions.changed',
        name: 'Permissions Changed',
        description: 'When your permissions have been modified',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'warning',
      },
      {
        id: 'system.maintenance.scheduled',
        name: 'Maintenance Scheduled',
        description: 'When system maintenance is scheduled',
        defaultEnabled: true,
        defaultChannels: ['inApp', 'email'],
        severity: 'info',
      },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

interface NotificationEventConfigProps {
  organizationId?: string;
}

export const NotificationEventConfig: React.FC<NotificationEventConfigProps> = ({
  organizationId,
}) => {
  // State
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [_roles, setRoles] = useState<Role[]>([]); // Reserved for future role-based filtering
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['pfa_changes']));
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'organization' | 'role'>('all');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(organizationId || null);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('pfa_auth_token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch notification rules, organizations, and roles in parallel
        const [rulesRes, orgsRes, rolesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/notifications/event-rules`, { headers }),
          fetch(`${API_BASE_URL}/api/organizations`, { headers }),
          fetch(`${API_BASE_URL}/api/role-templates`, { headers }),
        ]);

        if (rulesRes.ok) {
          const rulesData = await rulesRes.json();
          setRules(rulesData.rules || []);
        } else {
          // If no rules exist yet, initialize with defaults
          initializeDefaultRules();
        }

        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          setOrganizations(orgsData.organizations || orgsData || []);
        }

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(rolesData.templates || rolesData || []);
        }
      } catch (err) {
        console.error('Failed to fetch notification config:', err);
        // Initialize with defaults if fetch fails
        initializeDefaultRules();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const initializeDefaultRules = () => {
    const defaultRules: NotificationRule[] = [];
    EVENT_CATEGORIES.forEach(category => {
      category.events.forEach(event => {
        defaultRules.push({
          id: `rule_${event.id}_global`,
          eventType: event.id,
          scope: 'global',
          enabled: event.defaultEnabled,
          channels: {
            inApp: event.defaultChannels.includes('inApp'),
            email: event.defaultChannels.includes('email'),
            slack: event.defaultChannels.includes('slack'),
            teams: event.defaultChannels.includes('teams'),
          },
          quietHoursOverride: event.severity === 'critical',
        });
      });
    });
    setRules(defaultRules);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getEventRule = (eventId: string, scope: string, scopeId?: string): NotificationRule | undefined => {
    return rules.find(r =>
      r.eventType === eventId &&
      r.scope === scope &&
      (scopeId ? r.scopeId === scopeId : !r.scopeId)
    );
  };

  const updateRule = useCallback((
    eventId: string,
    scope: 'global' | 'organization' | 'role' | 'user',
    scopeId: string | undefined,
    updates: Partial<NotificationRule>
  ) => {
    setRules(prev => {
      const existingIndex = prev.findIndex(r =>
        r.eventType === eventId &&
        r.scope === scope &&
        (scopeId ? r.scopeId === scopeId : !r.scopeId)
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...updates };
        return updated;
      } else {
        // Create new rule
        const event = EVENT_CATEGORIES
          .flatMap(c => c.events)
          .find(e => e.id === eventId);

        if (!event) return prev;

        return [...prev, {
          id: `rule_${eventId}_${scope}_${scopeId || 'default'}_${Date.now()}`,
          eventType: eventId,
          scope,
          scopeId,
          enabled: true,
          channels: {
            inApp: event.defaultChannels.includes('inApp'),
            email: event.defaultChannels.includes('email'),
            slack: event.defaultChannels.includes('slack'),
            teams: event.defaultChannels.includes('teams'),
          },
          quietHoursOverride: event.severity === 'critical',
          ...updates,
        }];
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('pfa_auth_token');
      const res = await fetch(`${API_BASE_URL}/api/notifications/event-rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rules }),
      });

      if (!res.ok) {
        throw new Error('Failed to save notification rules');
      }

      setSuccess('Notification rules saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/50 text-red-400 border border-red-800">Critical</span>;
      case 'warning':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-900/50 text-amber-400 border border-amber-800">Warning</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-900/50 text-blue-400 border border-blue-800">Info</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Notification Events</h2>
            <p className="text-sm text-slate-400">
              Configure which events trigger notifications and how they're delivered
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-900/50 text-green-400 rounded-lg border border-green-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-900/50 text-red-400 rounded-lg border border-red-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Scope Filter */}
      <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <Filter className="w-5 h-5 text-slate-400" />
        <span className="text-sm text-slate-400">Filter by scope:</span>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All', icon: <Globe className="w-4 h-4" /> },
            { value: 'global', label: 'Global', icon: <Globe className="w-4 h-4" /> },
            { value: 'organization', label: 'Organization', icon: <Building2 className="w-4 h-4" /> },
            { value: 'role', label: 'Role', icon: <Users className="w-4 h-4" /> },
          ].map(scope => (
            <button
              key={scope.value}
              onClick={() => setScopeFilter(scope.value as typeof scopeFilter)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                scopeFilter === scope.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {scope.icon}
              {scope.label}
            </button>
          ))}
        </div>

        {scopeFilter === 'organization' && (
          <select
            value={selectedOrg || ''}
            onChange={(e) => setSelectedOrg(e.target.value || null)}
            className="ml-4 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
          >
            <option value="">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Event Categories */}
      <div className="space-y-4">
        {EVENT_CATEGORIES.map(category => (
          <div
            key={category.id}
            className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{category.icon}</span>
                <div className="text-left">
                  <h3 className="font-medium text-white">{category.name}</h3>
                  <p className="text-xs text-slate-500">{category.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {category.events.length} events
                </span>
                {expandedCategories.has(category.id) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Events */}
            {expandedCategories.has(category.id) && (
              <div className="border-t border-slate-700">
                {category.events.map(event => {
                  const globalRule = getEventRule(event.id, 'global');
                  const displayRule = globalRule || {
                    enabled: event.defaultEnabled,
                    channels: {
                      inApp: event.defaultChannels.includes('inApp'),
                      email: event.defaultChannels.includes('email'),
                      slack: event.defaultChannels.includes('slack'),
                      teams: event.defaultChannels.includes('teams'),
                    },
                    quietHoursOverride: event.severity === 'critical',
                  };

                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-750/50"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => updateRule(event.id, 'global', undefined, {
                            enabled: !displayRule.enabled,
                          })}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            displayRule.enabled
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-500'
                          }`}
                        >
                          {displayRule.enabled ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </button>

                        {/* Event Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${displayRule.enabled ? 'text-white' : 'text-slate-500'}`}>
                              {event.name}
                            </span>
                            {getSeverityBadge(event.severity)}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {event.description}
                          </p>
                        </div>
                      </div>

                      {/* Channel Toggles */}
                      {displayRule.enabled && (
                        <div className="flex items-center gap-2">
                          {/* In-App */}
                          <button
                            onClick={() => updateRule(event.id, 'global', undefined, {
                              channels: {
                                ...displayRule.channels,
                                inApp: !displayRule.channels.inApp,
                              },
                            })}
                            className={`p-2 rounded-lg transition-colors ${
                              displayRule.channels.inApp
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'bg-slate-700 text-slate-500'
                            }`}
                            title="In-App Toast"
                          >
                            <Bell className="w-4 h-4" />
                          </button>

                          {/* Email */}
                          <button
                            onClick={() => updateRule(event.id, 'global', undefined, {
                              channels: {
                                ...displayRule.channels,
                                email: !displayRule.channels.email,
                              },
                            })}
                            className={`p-2 rounded-lg transition-colors ${
                              displayRule.channels.email
                                ? 'bg-emerald-600/20 text-emerald-400'
                                : 'bg-slate-700 text-slate-500'
                            }`}
                            title="Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {/* Slack */}
                          <button
                            onClick={() => updateRule(event.id, 'global', undefined, {
                              channels: {
                                ...displayRule.channels,
                                slack: !displayRule.channels.slack,
                              },
                            })}
                            className={`p-2 rounded-lg transition-colors ${
                              displayRule.channels.slack
                                ? 'bg-purple-600/20 text-purple-400'
                                : 'bg-slate-700 text-slate-500'
                            }`}
                            title="Slack"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Quiet Hours Override */}
                          <button
                            onClick={() => updateRule(event.id, 'global', undefined, {
                              quietHoursOverride: !displayRule.quietHoursOverride,
                            })}
                            className={`p-2 rounded-lg transition-colors ${
                              displayRule.quietHoursOverride
                                ? 'bg-amber-600/20 text-amber-400'
                                : 'bg-slate-700 text-slate-500'
                            }`}
                            title={displayRule.quietHoursOverride ? 'Bypasses quiet hours' : 'Respects quiet hours'}
                          >
                            {displayRule.quietHoursOverride ? (
                              <Bell className="w-4 h-4" />
                            ) : (
                              <BellOff className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Channel Legend</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded">
              <Bell className="w-3 h-3" />
            </div>
            <span className="text-slate-400">In-App Toast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded">
              <Mail className="w-3 h-3" />
            </div>
            <span className="text-slate-400">Email</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded">
              <MessageSquare className="w-3 h-3" />
            </div>
            <span className="text-slate-400">Slack/Teams</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-600/20 text-amber-400 rounded">
              <Bell className="w-3 h-3" />
            </div>
            <span className="text-slate-400">Bypasses Quiet Hours</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationEventConfig;
