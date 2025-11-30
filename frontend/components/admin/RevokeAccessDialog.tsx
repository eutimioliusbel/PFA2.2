/**
 * RevokeAccessDialog Component
 * Phase 5, Task 5.3 - User-Organization Permission Manager
 *
 * Confirmation dialog for revoking user access to organization:
 * - Shows impact warning
 * - Requires reason for audit trail
 * - Confirmation checkbox
 */

import React, { useState } from 'react';
import { AlertTriangle, UserX, X } from 'lucide-react';

interface RevokeAccessDialogProps {
  userOrgId: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RevokeAccessDialog({ userOrgId: _userOrgId, onConfirm, onCancel }: RevokeAccessDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmed && reason.trim()) {
      onConfirm(reason);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <UserX className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold text-slate-100">Revoke Organization Access</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Warning Banner */}
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="font-semibold text-lg">Warning: Revoking Organization Access</p>
                <p>Revoking this user's access to the organization will have the following effects:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>User will <strong>lose all access</strong> to organization data</li>
                  <li>User will be <strong>logged out</strong> of active sessions</li>
                  <li>User will <strong>not appear</strong> in organization user lists</li>
                  <li>All custom permissions and capabilities will be <strong>removed</strong></li>
                </ul>
                <p className="mt-3 font-semibold text-red-400">
                  This action can be reversed by re-assigning the user, but all custom settings
                  will need to be reconfigured.
                </p>
              </div>
            </div>
          </div>

          {/* Reason Field */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason for Revoking Access <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., User left project team, role no longer required, security concern, etc."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
              rows={3}
              required
            />
            {!reason.trim() && (
              <span className="text-xs text-red-400 mt-1 block">
                Reason is required and will be logged in audit trail
              </span>
            )}
          </div>

          {/* Confirmation Checkbox */}
          <div className="bg-slate-900 border border-slate-600 rounded p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-5 h-5 bg-slate-800 border-slate-600 rounded mt-0.5 focus:ring-2 focus:ring-red-500"
              />
              <span className="text-sm text-slate-300">
                I understand that revoking this user's access to the organization will remove all
                their permissions and capabilities. I have provided a valid reason for this action.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              type="submit"
              disabled={!confirmed || !reason.trim()}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
                !confirmed || !reason.trim()
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <UserX className="w-4 h-4" />
              Revoke Access
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
