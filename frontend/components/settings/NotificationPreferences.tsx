// components/settings/NotificationPreferences.tsx
/**
 * Notification Preferences Component
 *
 * Phase 7, Task 7.5 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 20: Behavioral Quiet Mode
 *
 * Allows users to configure their notification timing preferences
 * and view AI-learned engagement patterns.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  RefreshCw,
  Brain,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  Settings,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';

// ============================================================================
// Types
// ============================================================================

interface Preferences {
  quietModeEnabled: boolean;
  quietHours: { start: string; end: string };
  peakHours: { start: string; end: string };
  urgentChannel: string;
  routineChannel: string;
  digestEnabled: boolean;
  digestFrequency: string;
  digestTime: string;
  aiLearningEnabled: boolean;
  aiConfidence: number;
}

interface EngagementProfile {
  userId: string;
  peakAttentionHours: string[];
  quietHours: string[];
  preferredChannels: {
    urgent: string;
    routine: string;
  };
  notificationSaturation: {
    status: 'HEALTHY' | 'MODERATE' | 'OVERLOADED';
    dailyCount: number;
    recommendation: string;
  };
  confidence: number;
  dataPoints: number;
  lastAnalyzedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Channel icon helper - may be used by parent components
export const getChannelIcon = (channel: string) => {
  switch (channel) {
    case 'email':
      return <Mail className="w-4 h-4" />;
    case 'slack':
      return <MessageSquare className="w-4 h-4" />;
    case 'in_app':
    default:
      return <Smartphone className="w-4 h-4" />;
  }
};

const getSaturationColor = (status: string): string => {
  switch (status) {
    case 'OVERLOADED':
      return 'text-red-400 bg-red-900/50';
    case 'MODERATE':
      return 'text-yellow-400 bg-yellow-900/50';
    case 'HEALTHY':
    default:
      return 'text-green-400 bg-green-900/50';
  }
};

// ============================================================================
// Component
// ============================================================================

export const NotificationPreferences: React.FC = () => {
  const { user: _user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [engagementProfile, setEngagementProfile] = useState<EngagementProfile | null>(null);

  // Fetch preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<{ success: boolean; preferences: Preferences }>(
          '/api/notifications/preferences'
        );
        setPreferences(response.preferences);
      } catch (err: any) {
        setError(err.message || 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Fetch engagement profile
  const fetchEngagementProfile = useCallback(async (forceRefresh = false) => {
    setLoadingProfile(true);

    try {
      const url = forceRefresh
        ? '/api/notifications/engagement-profile?refresh=true'
        : '/api/notifications/engagement-profile';
      const response = await apiClient.get<{ success: boolean; engagementProfile: EngagementProfile }>(url);
      setEngagementProfile(response.engagementProfile);
    } catch (err: any) {
      console.error('Failed to load engagement profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (preferences?.aiLearningEnabled) {
      fetchEngagementProfile();
    }
  }, [preferences?.aiLearningEnabled, fetchEngagementProfile]);

  // Save preferences
  const handleSave = useCallback(async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.put('/api/notifications/preferences', {
        quietModeEnabled: preferences.quietModeEnabled,
        quietHoursStart: preferences.quietHours.start,
        quietHoursEnd: preferences.quietHours.end,
        peakHoursStart: preferences.peakHours.start,
        peakHoursEnd: preferences.peakHours.end,
        urgentChannel: preferences.urgentChannel,
        routineChannel: preferences.routineChannel,
        enableDigest: preferences.digestEnabled,
        digestFrequency: preferences.digestFrequency,
        digestTime: preferences.digestTime,
        aiLearningEnabled: preferences.aiLearningEnabled,
      });

      setSuccess('Preferences saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  // Update preference value
  const updatePreference = useCallback(<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    setPreferences(prev => prev ? { ...prev, [key]: value } : null);
  }, []);

  // Update nested preference value
  const updateNestedPreference = useCallback((
    parent: 'quietHours' | 'peakHours',
    key: 'start' | 'end',
    value: string
  ) => {
    setPreferences(prev => prev ? {
      ...prev,
      [parent]: { ...prev[parent], [key]: value },
    } : null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-6 bg-red-900/50 text-red-400 rounded-lg border border-red-800">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        Failed to load preferences. Please refresh the page.
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
            <h2 className="text-xl font-semibold text-white">Notification Preferences</h2>
            <p className="text-sm text-slate-400">Configure when and how you receive notifications</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
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
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quiet Mode Section */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BellOff className="w-5 h-5 text-slate-400" />
              <h3 className="font-medium text-white">Quiet Mode</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.quietModeEnabled}
                onChange={(e) => updatePreference('quietModeEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            When enabled, routine notifications are deferred during quiet hours and batched for delivery during your peak attention time.
          </p>

          {preferences.quietModeEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Quiet Hours (Low Engagement)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => updateNestedPreference('quietHours', 'start', e.target.value)}
                    className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => updateNestedPreference('quietHours', 'end', e.target.value)}
                    className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Zap className="w-4 h-4 inline mr-1" />
                  Peak Hours (High Engagement)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={preferences.peakHours.start}
                    onChange={(e) => updateNestedPreference('peakHours', 'start', e.target.value)}
                    className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    value={preferences.peakHours.end}
                    onChange={(e) => updateNestedPreference('peakHours', 'end', e.target.value)}
                    className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Channel Preferences Section */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-slate-400" />
            <h3 className="font-medium text-white">Channel Preferences</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Urgent Notifications
              </label>
              <select
                value={preferences.urgentChannel}
                onChange={(e) => updatePreference('urgentChannel', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="in_app">In-App</option>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Routine Notifications
              </label>
              <select
                value={preferences.routineChannel}
                onChange={(e) => updatePreference('routineChannel', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="in_app">In-App</option>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
            </div>
          </div>
        </div>

        {/* Digest Settings Section */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-slate-400" />
              <h3 className="font-medium text-white">Notification Digest</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.digestEnabled}
                onChange={(e) => updatePreference('digestEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {preferences.digestEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Digest Frequency
                </label>
                <select
                  value={preferences.digestFrequency}
                  onChange={(e) => updatePreference('digestFrequency', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="twice_daily">Twice Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Delivery Time
                </label>
                <input
                  type="time"
                  value={preferences.digestTime}
                  onChange={(e) => updatePreference('digestTime', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* AI Learning Section */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h3 className="font-medium text-white">AI Learning</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.aiLearningEnabled}
                onChange={(e) => updatePreference('aiLearningEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Allow AI to learn your engagement patterns and automatically adjust quiet/peak hours based on your behavior over 4+ months.
          </p>

          {preferences.aiLearningEnabled && (
            <div className="bg-purple-900/50 rounded-lg p-4 border border-purple-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-300">AI Confidence</span>
                <span className="text-sm text-purple-400">
                  {Math.round(preferences.aiConfidence * 100)}%
                </span>
              </div>
              <div className="w-full bg-purple-900 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${preferences.aiConfidence * 100}%` }}
                />
              </div>
              <p className="text-xs text-purple-400 mt-2">
                Based on {engagementProfile?.dataPoints || 0} notification interactions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* AI Engagement Profile */}
      {preferences.aiLearningEnabled && (
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium text-white">AI-Learned Engagement Profile</h3>
            </div>
            <button
              onClick={() => fetchEngagementProfile(true)}
              disabled={loadingProfile}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
            >
              {loadingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Re-analyze
            </button>
          </div>

          {loadingProfile && !engagementProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : engagementProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Peak Hours */}
              <div className="bg-green-900/50 rounded-lg p-4 border border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-300">Peak Attention Hours</span>
                </div>
                <p className="text-lg font-semibold text-green-400">
                  {engagementProfile.peakAttentionHours.join(', ') || 'Not enough data'}
                </p>
                <p className="text-xs text-green-500 mt-1">
                  You engage with 60%+ of notifications during these hours
                </p>
              </div>

              {/* Quiet Hours */}
              <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <BellOff className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">Quiet Hours</span>
                </div>
                <p className="text-lg font-semibold text-blue-400">
                  {engagementProfile.quietHours.join(', ') || 'Not enough data'}
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  Low engagement detected during these hours
                </p>
              </div>

              {/* Saturation Status */}
              <div className={`rounded-lg p-4 border ${
                engagementProfile.notificationSaturation.status === 'OVERLOADED'
                  ? 'border-red-800'
                  : engagementProfile.notificationSaturation.status === 'MODERATE'
                    ? 'border-yellow-800'
                    : 'border-green-800'
              } ${getSaturationColor(engagementProfile.notificationSaturation.status)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Info className={`w-4 h-4 ${getSaturationColor(engagementProfile.notificationSaturation.status).split(' ')[0]}`} />
                  <span className={`text-sm font-medium ${getSaturationColor(engagementProfile.notificationSaturation.status).split(' ')[0].replace('-400', '-300')}`}>
                    Notification Load
                  </span>
                </div>
                <p className={`text-lg font-semibold ${getSaturationColor(engagementProfile.notificationSaturation.status).split(' ')[0]}`}>
                  {engagementProfile.notificationSaturation.status}
                </p>
                <p className={`text-xs mt-1 ${getSaturationColor(engagementProfile.notificationSaturation.status).split(' ')[0].replace('-400', '-500')}`}>
                  {engagementProfile.notificationSaturation.dailyCount} notifications/day avg
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Info className="w-8 h-8 mx-auto mb-2" />
              <p>Not enough data to generate engagement profile.</p>
              <p className="text-sm">Keep using the system and we'll learn your patterns!</p>
            </div>
          )}

          {engagementProfile && engagementProfile.notificationSaturation.recommendation && (
            <div className="mt-4 p-3 bg-slate-700 rounded-lg border border-slate-600">
              <p className="text-sm text-slate-300">
                <strong className="text-white">AI Recommendation:</strong> {engagementProfile.notificationSaturation.recommendation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationPreferences;
