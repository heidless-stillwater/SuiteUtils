import type { DeployEstimate, DeploymentRecord } from './types';
import { parseDate } from './utils';

// ============================================================
// EXPERT SYSTEM — Learning Deploy Estimator
// ============================================================

// Phase 1: Heuristic defaults (seconds)
const HEURISTIC_DEFAULTS: Record<string, number> = {
  firebase: 120,       // ~2 minutes
  'cloud-build': 300,  // ~5 minutes
};

/**
 * Calculate a deployment time estimate for an app.
 * 
 * Phase 1: Uses heuristic defaults based on deploy method.
 * Phase 2 (when data exists): Uses rolling weighted average of historical data.
 */
export function getEstimate(
  appId: string,
  deployMethod: string,
  history: DeploymentRecord[] = []
): DeployEstimate {
  // Filter to successful deploys for this app
  const appHistory = history.filter(
    (d) => d.appId === appId && d.status === 'live' && d.duration != null
  );

  if (appHistory.length < 3) {
    // Not enough data — use heuristics
    const estimated = HEURISTIC_DEFAULTS[deployMethod] || 180;
    return {
      appId,
      estimatedDuration: estimated,
      confidence: 0.3,
      sampleSize: appHistory.length,
      reasoning: appHistory.length === 0
        ? `Heuristic estimate for ${deployMethod} deployments (~${Math.round(estimated / 60)}min). No historical data yet.`
        : `Heuristic estimate with ${appHistory.length} prior deploy(s) — need ≥3 for statistical estimates.`,
    };
  }

  // Phase 2: Weighted rolling average (recent deploys weighted 2x)
  const sorted = [...appHistory].sort(
    (a, b) => parseDate(b.startedAt).getTime() - parseDate(a.startedAt).getTime()
  );

  let totalWeight = 0;
  let weightedSum = 0;
  const durations: number[] = [];

  sorted.forEach((deploy, index) => {
    const duration = deploy.duration!;
    durations.push(duration);
    // Recent deploys get higher weight
    const weight = index < 3 ? 2 : 1;
    weightedSum += duration * weight;
    totalWeight += weight;
  });

  const weightedAvg = weightedSum / totalWeight;

  // Calculate standard deviation
  const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
  const variance = durations.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  // Confidence based on sample size and variance
  const confidence = Math.min(0.95, 0.5 + (appHistory.length * 0.05) - (stdDev / mean) * 0.2);

  return {
    appId,
    estimatedDuration: Math.round(weightedAvg),
    confidence: Math.max(0.1, Math.round(confidence * 100) / 100),
    sampleSize: appHistory.length,
    reasoning: `Based on ${appHistory.length} prior deploys of ${appId}, avg build time: ${formatDuration(Math.round(weightedAvg))} ±${formatDuration(Math.round(stdDev))}`,
  };
}

/** Format seconds to human readable duration */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m${secs}s` : `${mins}m`;
}

/** Format elapsed time as mm:ss counter */
export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
