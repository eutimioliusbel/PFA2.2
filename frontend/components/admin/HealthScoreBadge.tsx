/**
 * Health Score Badge Component
 * Phase 5, Task 5.7 - BEO Glass Mode
 *
 * Color-coded health score display.
 */

// React imported implicitly by JSX transform
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HealthScoreBadgeProps {
  score: number;
  showTrend?: boolean;
  previousScore?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function HealthScoreBadge({
  score,
  showTrend = false,
  previousScore,
  size = 'md',
}: HealthScoreBadgeProps) {
  const getHealthColor = (score: number): 'green' | 'yellow' | 'red' => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };

  const getHealthLabel = (score: number): string => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Warning';
    return 'Critical';
  };

  const color = getHealthColor(score);
  const label = getHealthLabel(score);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const colorClasses = {
    green: 'bg-green-500/20 text-green-300 border-green-500/40',
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    red: 'bg-red-500/20 text-red-300 border-red-500/40',
  };

  const trend = showTrend && previousScore !== undefined ? score - previousScore : null;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded border ${sizeClasses[size]} ${colorClasses[color]}`}
      >
        <span className={`w-2 h-2 rounded-full bg-current`} />
        {score}% {label}
      </span>
      {trend !== null && trend !== 0 && (
        <span
          className={`text-xs flex items-center gap-0.5 ${
            trend > 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {trend > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {Math.abs(trend).toFixed(1)}%
        </span>
      )}
      {trend === 0 && showTrend && (
        <span className="text-xs flex items-center gap-0.5 text-slate-400">
          <Minus className="w-3 h-3" />
          No change
        </span>
      )}
    </div>
  );
}
