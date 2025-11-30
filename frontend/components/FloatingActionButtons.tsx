/**
 * FloatingActionButtons Component
 * Phase 2: Large File Refactoring
 *
 * Floating action buttons for draft management, AI, and new forecast
 */

import React from 'react';
import { Save, Trash2, Send, Mic, Brain, X, Plus, Loader2 } from 'lucide-react';

type AiMode = 'hidden' | 'panel' | 'voice';

interface FloatingActionButtonsProps {
  hasUnsavedChanges: boolean;
  isSubmitting: boolean;
  pendingModificationsCount: number;
  aiMode: AiMode;
  setAiMode: (mode: AiMode) => void;
  setShowNewForecastModal: (show: boolean) => void;
  handleSaveDraft: () => void;
  handleDiscardChanges: () => void;
  handleSubmitChanges: () => void;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  hasUnsavedChanges,
  isSubmitting,
  pendingModificationsCount,
  aiMode,
  setAiMode,
  setShowNewForecastModal,
  handleSaveDraft,
  handleDiscardChanges,
  handleSubmitChanges,
}) => {
  return (
    <div className="fixed bottom-8 right-6 z-50 flex flex-col gap-4 items-center">
      {hasUnsavedChanges && (
        <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-8 fade-in duration-300 pb-2 items-center">
          <button
            onClick={handleSaveDraft}
            disabled={isSubmitting || pendingModificationsCount === 0}
            className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 shadow-xl border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save Draft"
          >
            <Save className="w-5 h-5" />
          </button>
          <button
            onClick={handleDiscardChanges}
            disabled={isSubmitting}
            className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-xl border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-50"
            title="Discard All Drafts"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleSubmitChanges}
            disabled={isSubmitting}
            className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 border border-emerald-400 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-70"
            title="Submit Changes"
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-5 h-5 ml-0.5" />
            )}
          </button>
          <div className="w-8 h-1 bg-slate-200 dark:bg-slate-700 rounded-full my-1"></div>
        </div>
      )}
      {aiMode !== 'voice' && (
        <button
          onClick={() => setAiMode('voice')}
          className="w-12 h-12 bg-slate-800 dark:bg-slate-700 text-white rounded-full shadow-xl border border-slate-600 flex items-center justify-center hover:bg-slate-700 dark:hover:bg-slate-600 transition-all transform hover:scale-110"
          title="Voice Command"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}
      <button
        onClick={() => setAiMode(aiMode === 'hidden' ? 'panel' : 'hidden')}
        className={`w-12 h-12 rounded-full shadow-xl border flex items-center justify-center transition-all transform hover:scale-110 ${aiMode !== 'hidden' ? 'bg-white text-violet-600 border-violet-200 rotate-90' : 'bg-violet-600 text-white border-violet-500'}`}
        title="AI Assistant"
      >
        {aiMode !== 'hidden' ? (
          <X className="w-6 h-6" />
        ) : (
          <Brain className="w-6 h-6" />
        )}
      </button>
      {aiMode === 'hidden' && (
        <button
          onClick={() => setShowNewForecastModal(true)}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-xl shadow-blue-600/30 border border-blue-500 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95"
          title="Add Forecast"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
