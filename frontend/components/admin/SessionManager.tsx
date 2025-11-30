/**
 * SessionManager Component (ADR-005)
 * Security kill-switch for active user sessions
 */

import { useState, useEffect } from 'react';
import { Monitor, RefreshCw, AlertCircle, X, Smartphone, Globe } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { UserSession } from '../../types';

interface SessionManagerProps {
  userId: string;
  username: string;
}

export function SessionManager({ userId, username }: SessionManagerProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserSessions(userId);
      setSessions(response.sessions);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Revoke this session? The user will be immediately logged out.')) {
      return;
    }

    try {
      await apiClient.revokeSession(sessionId);
      await loadSessions();
    } catch (err: any) {
      alert(`Failed to revoke session: ${err.message}`);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm(`Revoke all sessions for ${username}? This will log them out everywhere.`)) {
      return;
    }

    try {
      const response = await apiClient.revokeAllSessions(userId, true);
      alert(`Revoked ${response.revokedCount} sessions`);
      await loadSessions();
    } catch (err: any) {
      alert(`Failed to revoke sessions: ${err.message}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          <Monitor className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Active Sessions</h2>
            <p className="text-sm text-slate-400 mt-1">
              {username} has {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSessions}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Revoke All Sessions
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

      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`bg-slate-800 rounded-lg border p-4 hover:border-blue-500/50 transition-colors ${
              session.isCurrent ? 'border-green-500/50' : 'border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {session.deviceInfo?.browser?.includes('Mobile') ? (
                    <Smartphone className="w-5 h-5 text-slate-400" />
                  ) : (
                    <Monitor className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="font-medium text-slate-100">
                    {session.deviceInfo?.browser || 'Unknown Browser'}
                  </span>
                  {session.isCurrent && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                      Current
                    </span>
                  )}
                  {session.invalidatedAt && (
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                      Revoked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {session.deviceInfo?.ip || 'Unknown IP'}
                  </div>
                  {session.deviceInfo?.location && (
                    <span>{session.deviceInfo.location}</span>
                  )}
                  <span>Last active: {formatDate(session.lastActiveAt)}</span>
                </div>
              </div>
              {!session.isCurrent && !session.invalidatedAt && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                  title="Revoke Session"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
