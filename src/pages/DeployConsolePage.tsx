import { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  Play,
  Pause,
  Square,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  RotateCcw,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { useSuite } from '../contexts/SuiteContext';
import type { DeployStatus, EnvironmentTag } from '../lib/types';
import { getEstimate, formatDuration, formatElapsed } from '../lib/expert-system';

interface AppDeployState {
  appId: string;
  displayName: string;
  selected: boolean;
  environment: EnvironmentTag;
  status: DeployStatus;
  startedAt: number | null;
  elapsed: number;
  deployMethod: string;
}

export function DeployConsolePage() {
  const { currentSuite } = useSuite();
  const [deployStates, setDeployStates] = useState<AppDeployState[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  // Initialize deploy states from suite apps
  useEffect(() => {
    if (!currentSuite) return;
    const states = Object.entries(currentSuite.apps).map(([id, app]) => ({
      appId: id,
      displayName: app.displayName,
      selected: false,
      environment: 'production' as EnvironmentTag,
      status: 'queued' as DeployStatus,
      startedAt: null,
      elapsed: 0,
      deployMethod: app.environments.production?.deployMethod || 'firebase',
    }));
    setDeployStates(states);
  }, [currentSuite]);

  // Elapsed time updater
  useEffect(() => {
    if (!batchRunning) return;
    const interval = setInterval(() => {
      setDeployStates((prev) =>
        prev.map((s) =>
          s.startedAt && (s.status === 'building' || s.status === 'deploying')
            ? { ...s, elapsed: Math.floor((Date.now() - s.startedAt) / 1000) }
            : s
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [batchRunning]);

  const toggleSelect = (appId: string) => {
    setDeployStates((prev) =>
      prev.map((s) => (s.appId === appId ? { ...s, selected: !s.selected } : s))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = deployStates.every((s) => s.selected);
    setDeployStates((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };

  const setEnvironment = (appId: string, env: EnvironmentTag) => {
    setDeployStates((prev) =>
      prev.map((s) => (s.appId === appId ? { ...s, environment: env } : s))
    );
  };

  // Simulated deploy flow (UI demo — real execution requires Cloud Functions)
  const startBatch = useCallback(() => {
    const selected = deployStates.filter((s) => s.selected);
    if (selected.length === 0) return;

    setBatchRunning(true);
    const now = Date.now();

    // Stagger deployments
    selected.forEach((app, index) => {
      const delay = index * 2000;

      setTimeout(() => {
        setDeployStates((prev) =>
          prev.map((s) =>
            s.appId === app.appId
              ? { ...s, status: 'building', startedAt: Date.now() }
              : s
          )
        );
      }, delay);

      setTimeout(() => {
        setDeployStates((prev) =>
          prev.map((s) =>
            s.appId === app.appId ? { ...s, status: 'deploying' } : s
          )
        );
      }, delay + 3000);

      setTimeout(() => {
        const success = Math.random() > 0.15; // 85% success rate demo
        setDeployStates((prev) => {
          const updated = prev.map((s) =>
            s.appId === app.appId
              ? {
                  ...s,
                  status: (success ? 'live' : 'failed') as DeployStatus,
                  elapsed: Math.floor((Date.now() - (s.startedAt || now)) / 1000),
                }
              : s
          );
          // Check if all done
          const active = updated.filter(
            (s) => s.selected && (s.status === 'building' || s.status === 'deploying' || s.status === 'queued')
          );
          if (active.length === 0) setBatchRunning(false);
          return updated;
        });
      }, delay + 6000);
    });
  }, [deployStates]);

  const selectedCount = deployStates.filter((s) => s.selected).length;
  const successCount = deployStates.filter((s) => s.selected && s.status === 'live').length;
  const failCount = deployStates.filter((s) => s.selected && s.status === 'failed').length;

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Deploy Console</h1>
          <p className="text-sm text-white/40 mt-1">
            Select apps and deploy in a single batch operation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleSelectAll} className="btn-ghost text-xs">
            {deployStates.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={startBatch}
            disabled={selectedCount === 0 || batchRunning}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Rocket className="w-4 h-4" />
            Deploy {selectedCount > 0 ? `(${selectedCount})` : ''}
          </button>
        </div>
      </div>

      {/* App Deploy Cards */}
      <div className="space-y-3">
        {deployStates.map((app) => (
          <AppDeployCard
            key={app.appId}
            app={app}
            onToggleSelect={() => toggleSelect(app.appId)}
            onSetEnv={(env) => setEnvironment(app.appId, env)}
            batchRunning={batchRunning}
          />
        ))}
      </div>

      {/* Batch Summary Bar */}
      {selectedCount > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-t border-white/5"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-white/40">Selected: </span>
              <span className="text-white/90 font-bold">{selectedCount}</span>
            </div>
            {batchRunning && (
              <>
                <div className="text-sm">
                  <span className="text-green-400/60">Success: </span>
                  <span className="text-green-400 font-bold">{successCount}</span>
                </div>
                <div className="text-sm">
                  <span className="text-red-400/60">Failed: </span>
                  <span className="text-red-400 font-bold">{failCount}</span>
                </div>
              </>
            )}
          </div>

          {/* Rollback Placeholder */}
          <div className="flex items-center gap-3">
            <button className="btn-ghost text-xs opacity-40 cursor-not-allowed" disabled>
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback
              <span className="badge badge-info text-[8px] !px-1.5 !py-0.5">Soon</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- App Deploy Card ---

function AppDeployCard({
  app,
  onToggleSelect,
  onSetEnv,
  batchRunning,
}: {
  app: AppDeployState;
  onToggleSelect: () => void;
  onSetEnv: (env: EnvironmentTag) => void;
  batchRunning: boolean;
}) {
  const estimate = getEstimate(app.appId, app.deployMethod);
  const progress =
    app.status === 'live' || app.status === 'failed'
      ? 100
      : app.startedAt
      ? Math.min(95, (app.elapsed / estimate.estimatedDuration) * 100)
      : 0;

  const statusIcon: Record<string, React.ReactNode> = {
    queued: <Clock className="w-4 h-4 text-white/30" />,
    building: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
    deploying: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
    live: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    failed: <AlertTriangle className="w-4 h-4 text-red-400" />,
    paused: <Pause className="w-4 h-4 text-amber-400" />,
    stopped: <Square className="w-4 h-4 text-white/40" />,
  };

  return (
    <div
      className={`glass-card-static p-5 transition-all duration-300 ${
        app.selected ? 'border-primary/20 bg-primary/[0.02]' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Checkbox */}
        <button
          onClick={onToggleSelect}
          disabled={batchRunning}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            app.selected
              ? 'bg-primary border-primary'
              : 'border-white/15 hover:border-white/30'
          }`}
        >
          {app.selected && <Zap className="w-3 h-3 text-white" />}
        </button>

        {/* App Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white/90">{app.displayName}</h3>
            {statusIcon[app.status]}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              app.status === 'live' ? 'text-green-400' :
              app.status === 'failed' ? 'text-red-400' :
              app.status === 'building' || app.status === 'deploying' ? 'text-amber-400' :
              'text-white/30'
            }`}>
              {app.status}
            </span>
          </div>

          {/* Progress Bar */}
          {app.selected && app.startedAt && (
            <div className="mt-2">
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${
                    app.status === 'failed' ? '!bg-red-500' : ''
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Environment Selector */}
        <select
          value={app.environment}
          onChange={(e) => onSetEnv(e.target.value as EnvironmentTag)}
          disabled={batchRunning}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none focus:border-primary/50 transition-colors"
        >
          <option value="production">production</option>
          <option value="staging">staging</option>
          <option value="dev">dev</option>
        </select>

        {/* Deploy Method Badge */}
        <span className="badge badge-primary text-[9px]">
          {app.deployMethod}
        </span>

        {/* Timer */}
        {app.startedAt && (
          <div className="text-right min-w-[80px]">
            <p className="text-sm font-mono text-white/70">
              {formatDuration(app.elapsed)}
            </p>
            <p className="text-[10px] text-white/25">
              est. {formatDuration(estimate.estimatedDuration)}
            </p>
          </div>
        )}
      </div>

      {/* Expert System Reasoning (on hover / expanded) */}
      {app.selected && !batchRunning && (
        <p className="mt-3 text-[11px] text-white/20 italic pl-9">
          {estimate.reasoning}
        </p>
      )}
    </div>
  );
}
