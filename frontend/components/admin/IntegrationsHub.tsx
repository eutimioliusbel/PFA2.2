/**
 * IntegrationsHub Component (ADR-005)
 * Webhook configuration for Slack, Teams, and custom integrations
 */

import { useState, useEffect } from 'react';
import { Webhook as WebhookIcon, Plus, Edit, Trash2, RefreshCw, AlertCircle, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Webhook } from '../../types';

const WEBHOOK_EVENTS = [
  { value: 'sync_failed', label: 'Sync Failed' },
  { value: 'user_added', label: 'User Added' },
  { value: 'permission_changed', label: 'Permission Changed' },
  { value: 'session_revoked', label: 'Session Revoked' },
  { value: 'org_suspended', label: 'Organization Suspended' },
  { value: 'pfa_imported', label: 'PFA Data Imported' },
];

interface IntegrationsHubProps {
  organizationId: string;
}

export function IntegrationsHub({ organizationId }: IntegrationsHubProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, [organizationId]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWebhooks(organizationId);
      setWebhooks(response.webhooks);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const response = await apiClient.testWebhook(id);
      alert(response.message);
    } catch (err: any) {
      alert(`Test failed: ${err.message}`);
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    if (!confirm(`Delete webhook for ${webhook.channelName || webhook.type}?`)) {
      return;
    }

    try {
      await apiClient.deleteWebhook(webhook.id);
      await loadWebhooks();
    } catch (err: any) {
      alert(`Failed to delete webhook: ${err.message}`);
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WebhookIcon className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Integrations Hub</h2>
            <p className="text-sm text-slate-400 mt-1">
              Configure webhooks for Slack, Teams, and custom integrations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadWebhooks}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              setSelectedWebhook(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-blue-500/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-100 capitalize">{webhook.type}</span>
                  {webhook.isActive ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                      <XCircle className="w-3 h-3" />
                      Inactive
                    </span>
                  )}
                </div>
                {webhook.channelName && (
                  <p className="text-sm text-slate-400">#{webhook.channelName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Events</div>
              <div className="flex flex-wrap gap-1">
                {webhook.events.map((event) => (
                  <span
                    key={event}
                    className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded"
                  >
                    {event.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTest(webhook.id)}
                className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors text-sm"
              >
                Test
              </button>
              <button
                onClick={() => {
                  setSelectedWebhook(webhook);
                  setShowEditor(true);
                }}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(webhook)}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showEditor && (
        <WebhookEditorModal
          webhook={selectedWebhook}
          organizationId={organizationId}
          onClose={() => {
            setShowEditor(false);
            setSelectedWebhook(null);
          }}
          onSave={() => {
            setShowEditor(false);
            setSelectedWebhook(null);
            loadWebhooks();
          }}
        />
      )}
    </div>
  );
}

interface WebhookEditorModalProps {
  webhook: Webhook | null;
  organizationId: string;
  onClose: () => void;
  onSave: () => void;
}

function WebhookEditorModal({ webhook, organizationId, onClose, onSave }: WebhookEditorModalProps) {
  const [type, setType] = useState<'slack' | 'teams' | 'custom'>(webhook?.type || 'slack');
  const [webhookUrl, setWebhookUrl] = useState(webhook?.webhookUrl || '');
  const [channelName, setChannelName] = useState(webhook?.channelName || '');
  const [events, setEvents] = useState<string[]>(webhook?.events || []);
  const [showUrl, setShowUrl] = useState(false);

  const handleToggleEvent = (eventValue: string) => {
    setEvents((prev) =>
      prev.includes(eventValue) ? prev.filter((e) => e !== eventValue) : [...prev, eventValue]
    );
  };

  const handleSubmit = async () => {
    if (!webhookUrl.trim()) {
      alert('Webhook URL is required');
      return;
    }
    if (events.length === 0) {
      alert('Select at least one event');
      return;
    }

    try {
      if (webhook) {
        await apiClient.updateWebhook(webhook.id, {
          webhookUrl: webhookUrl.trim(),
          channelName: channelName.trim() || undefined,
          events,
        });
      } else {
        await apiClient.createWebhook({
          organizationId,
          type,
          webhookUrl: webhookUrl.trim(),
          channelName: channelName.trim() || undefined,
          events,
        });
      }
      onSave();
    } catch (err: any) {
      alert(`Failed to save webhook: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700">
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-100">
            {webhook ? 'Edit' : 'Add'} Webhook
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              disabled={!!webhook}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
              <option value="custom">Custom Webhook</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
            <div className="relative">
              <input
                type={showUrl ? 'text' : 'password'}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 pr-10 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setShowUrl(!showUrl)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
              >
                {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Channel Name (Optional)
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g., #alerts"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Event Triggers</label>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label
                  key={event.value}
                  className="flex items-center gap-2 p-3 bg-slate-900 rounded cursor-pointer hover:bg-slate-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(event.value)}
                    onChange={() => handleToggleEvent(event.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300">{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
            >
              {webhook ? 'Update' : 'Create'} Webhook
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
