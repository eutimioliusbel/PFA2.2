/**
 * Narrative Reader Component
 *
 * Phase 8, Task 8.2 of ADR-005 Multi-Tenant Access Control
 * UC-22: Narrative Variance Generator
 *
 * Features:
 * - Chapter-based navigation
 * - Evidence collapsible sections
 * - Timeline visualization
 * - Reading progress tracking
 * - PDF export button
 * - Key takeaways summary
 * - Recommendations section
 *
 * Theme: Dark slate (consistent with app)
 */

import { useState, useEffect } from 'react';
import {
  BookOpen,
  Clock,
  Download,
  ChevronRight,
  ChevronDown,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  X,
} from 'lucide-react';

const API_BASE_URL =
  (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ||
  'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

interface Chapter {
  number: number;
  title: string;
  content: string;
  wordCount: number;
  evidence: Evidence[];
}

interface Evidence {
  id: string;
  type: 'audit_log' | 'pfa_record' | 'financial_data';
  timestamp: Date;
  description: string;
  actor?: string;
  impact?: string;
  metadata?: Record<string, unknown>;
}

interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  impact: number;
  category: 'plan' | 'event' | 'impact' | 'outcome';
  evidence: Evidence[];
}

interface NarrativeData {
  narrativeId: string;
  title: string;
  chapters: Chapter[];
  keyTakeaways: string[];
  timeline: TimelineEvent[];
  recommendations: string[];
  estimatedReadTime: number;
  metadata: {
    organizationCode: string;
    organizationName: string;
    totalVariance: number;
    variancePercent: number;
    affectedRecords: number;
    generatedAt: Date;
    modelUsed: string;
    latencyMs: number;
  };
}

interface NarrativeReaderProps {
  narrativeId?: string;
  organizationId?: string;
  onClose?: () => void;
  onBack?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function NarrativeReader({
  narrativeId,
  organizationId,
  onClose,
  onBack,
}: NarrativeReaderProps) {
  const [narrative, setNarrative] = useState<NarrativeData | null>(null);
  const [activeNarrativeId, setActiveNarrativeId] = useState<string | null>(narrativeId || null);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Only fetch if we have a specific narrativeId (viewing existing narrative)
  useEffect(() => {
    if (narrativeId) {
      setActiveNarrativeId(narrativeId);
      fetchNarrative(narrativeId);
    }
    // Don't auto-generate - let user trigger it manually when ready
  }, [narrativeId]);

  // Save reading progress when chapter changes
  useEffect(() => {
    if (narrative && currentChapter > 1 && activeNarrativeId) {
      saveReadingProgress(currentChapter);
    }
  }, [currentChapter, narrative, activeNarrativeId]);

  const handleGoBack = () => {
    if (onBack) {
      onBack();
    } else if (onClose) {
      onClose();
    } else {
      // Fallback: navigate back in history
      window.history.back();
    }
  };

  const generateNarrative = async () => {
    try {
      setGenerating(true);
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('pfa_auth_token');
      const response = await fetch(`${API_BASE_URL}/api/beo/narrative/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          title: 'Portfolio Variance Analysis',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate narrative');
      }

      const data = await response.json();
      if (data.narrative) {
        setNarrative(data.narrative);
        setActiveNarrativeId(data.narrative.narrativeId);
      } else {
        throw new Error('No narrative returned from generation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate narrative');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  const fetchNarrative = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('pfa_auth_token');
      const response = await fetch(`${API_BASE_URL}/api/beo/narrative/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch narrative');
      }

      const data = await response.json();
      setNarrative(data.narrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveReadingProgress = async (chapter: number) => {
    if (!activeNarrativeId) return;
    try {
      const token = localStorage.getItem('pfa_auth_token');
      await fetch(`${API_BASE_URL}/api/beo/narrative/${activeNarrativeId}/progress`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chapter }),
      });
    } catch (err) {
      console.warn('Failed to save reading progress:', err);
    }
  };

  const toggleEvidence = (evidenceId: string) => {
    const newExpanded = new Set(expandedEvidence);
    if (newExpanded.has(evidenceId)) {
      newExpanded.delete(evidenceId);
    } else {
      newExpanded.add(evidenceId);
    }
    setExpandedEvidence(newExpanded);
  };

  const handleExportPDF = async () => {
    if (!activeNarrativeId) return;
    try {
      const token = localStorage.getItem('pfa_auth_token');
      const response = await fetch(
        `${API_BASE_URL}/api/beo/narrative/${activeNarrativeId}/export-pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }

      // Get the HTML content
      const htmlContent = await response.text();

      // Open in new window for printing/saving as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        // Fallback: Download as HTML file
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `narrative-${activeNarrativeId}.html`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <div>
              <h3 className="font-semibold text-lg text-slate-100">
                {generating ? 'Generating Narrative' : 'Loading Narrative'}
              </h3>
              <p className="text-sm text-slate-400">
                {generating ? 'AI is analyzing your portfolio data...' : 'Fetching story...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !narrative) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red-500/20 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-100">Error Loading Narrative</h3>
              <p className="text-sm text-slate-400">{error || 'Narrative not found'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGoBack}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
            {organizationId && (
              <button
                onClick={generateNarrative}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const chapter = narrative.chapters[currentChapter - 1];
  const progress = (currentChapter / narrative.chapters.length) * 100;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 p-6 bg-slate-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={handleGoBack}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <h1 className="text-2xl font-bold text-slate-100">{narrative.title}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400 ml-11">
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>{narrative.chapters.length} Chapters</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{narrative.estimatedReadTime} min read</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span>{narrative.metadata.organizationCode}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden ml-11">
          <div
            className="absolute h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Chapter Navigation Pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 ml-11">
          {narrative.chapters.map((ch) => (
            <button
              key={ch.number}
              onClick={() => setCurrentChapter(ch.number)}
              className={`
                px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors
                ${
                  currentChapter === ch.number
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
              `}
            >
              {ch.number}. {ch.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Chapter Content */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4 text-slate-100">
            Chapter {chapter.number}: {chapter.title}
          </h2>
          {chapter.content.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-slate-300 leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Evidence Section */}
        {chapter.evidence.length > 0 && (
          <div className="max-w-4xl mx-auto border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-100">
              <FileText className="w-5 h-5 text-slate-400" />
              Evidence ({chapter.evidence.length})
            </h3>
            <div className="space-y-3">
              {chapter.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800"
                >
                  <button
                    onClick={() => toggleEvidence(ev.id)}
                    className="w-full px-4 py-3 hover:bg-slate-700 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedEvidence.has(ev.id) ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="font-medium text-slate-200">{ev.description}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </button>
                  {expandedEvidence.has(ev.id) && (
                    <div className="px-4 py-3 bg-slate-900 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Type:</span>
                          <span className="ml-2 font-medium text-slate-300">{ev.type}</span>
                        </div>
                        {ev.actor && (
                          <div>
                            <span className="text-slate-500">Actor:</span>
                            <span className="ml-2 font-medium text-slate-300">{ev.actor}</span>
                          </div>
                        )}
                        {ev.impact && (
                          <div>
                            <span className="text-slate-500">Impact:</span>
                            <span className="ml-2 font-medium text-slate-300">{ev.impact}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Visualization (shown on final chapter) */}
        {currentChapter === narrative.chapters.length && (
          <div className="max-w-4xl mx-auto border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-100">
              <TrendingUp className="w-5 h-5 text-slate-400" />
              Timeline
            </h3>
            <div className="space-y-4">
              {narrative.timeline.map((event, idx) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${event.category === 'plan' ? 'bg-blue-500/20 text-blue-400' : ''}
                        ${event.category === 'event' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                        ${event.category === 'impact' ? 'bg-orange-500/20 text-orange-400' : ''}
                        ${event.category === 'outcome' ? 'bg-green-500/20 text-green-400' : ''}
                      `}
                    >
                      <FileText className="w-5 h-5" />
                    </div>
                    {idx < narrative.timeline.length - 1 && (
                      <div className="w-0.5 h-16 bg-slate-700 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-slate-200">{event.title}</h4>
                      <span className="text-xs text-slate-500">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{event.description}</p>
                    {event.impact !== 0 && (
                      <span
                        className={`
                          inline-flex items-center px-2 py-1 rounded text-xs font-medium
                          ${event.impact > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                        `}
                      >
                        {event.impact > 0 ? '+' : ''}${event.impact.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Takeaways (shown on final chapter) */}
        {currentChapter === narrative.chapters.length && (
          <div className="max-w-4xl mx-auto border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-100">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Key Takeaways
            </h3>
            <ul className="space-y-2">
              {narrative.keyTakeaways.map((takeaway, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-slate-300">{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations (shown on final chapter) */}
        {currentChapter === narrative.chapters.length && (
          <div className="max-w-4xl mx-auto border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-100">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              Recommendations
            </h3>
            <ul className="space-y-2">
              {narrative.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">{idx + 1}.</span>
                  <span className="text-slate-300">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-slate-700 p-6 bg-slate-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={() => setCurrentChapter(Math.max(1, currentChapter - 1))}
            disabled={currentChapter === 1}
            className={`
              px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors
              ${
                currentChapter === 1
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }
            `}
          >
            ← Previous Chapter
          </button>
          <span className="text-sm text-slate-400">
            Chapter {currentChapter} of {narrative.chapters.length}
          </span>
          <button
            onClick={() =>
              setCurrentChapter(Math.min(narrative.chapters.length, currentChapter + 1))
            }
            disabled={currentChapter === narrative.chapters.length}
            className={`
              px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors
              ${
                currentChapter === narrative.chapters.length
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }
            `}
          >
            Next Chapter →
          </button>
        </div>
      </div>
    </div>
  );
}
