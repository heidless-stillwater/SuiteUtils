import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Rocket,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Zap,
  ChevronDown,
  Terminal,
  ExternalLink,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import type { DeployStatus, EnvironmentTag, DeploymentRecord } from '../lib/types';
import { getEstimate, formatDuration, formatElapsed } from '../lib/expert-system';
import { saveDeployRecord, subscribeToDeployHistory } from '../lib/deployment-service';

const API_URL = 'http://localhost:5181';

interface AppDeployState {
  appId: string;
  displayName: string;
  selected: boolean;
  environment: EnvironmentTag;
  status: DeployStatus;
  startedAt: number | null;
  elapsed: number;
  deployMethod: string;
  projectPath: string;
  hostingTarget: string | null;
  project: string;
  logs: string[];
  deployUrl: string | null;
  error: string | null;
  releaseRef: string;
  isIsolated: boolean;
}

export function DeployConsolePage() {
  const { currentSuite, updateAppStatus } = useSuite();
  const { user } = useAuth();
  const [deployStates, setDeployStates] = useState<AppDeployState[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [deployHistory, setDeployHistory] = useState<DeploymentRecord[]>([]);

  // Per-app rollback state: stage | message | error | url
  const [rollbackStates, setRollbackStates] = useState<Record<string, { active: boolean; stage: string; message: string; error?: string; url?: string }>>({});

  // Check API health on mount
  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((r) => r.ok ? setApiAvailable(true) : setApiAvailable(false))
      .catch(() => setApiAvailable(false));
  }, []);

  // Subscribe to Firestore deploy history for this suite (feeds expert system)
  useEffect(() => {
    if (!currentSuite) return;
    const unsub = subscribeToDeployHistory(
      currentSuite.id,
      (records) => setDeployHistory(records),
    );
    return () => unsub();
  }, [currentSuite]);

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
      projectPath: app.path,
      hostingTarget: app.environments.production?.hostingTarget || null,
      project: app.project || 'heidless-apps-0',
      logs: [],
      deployUrl: null,
      error: null,
      releaseRef: 'main',
      isIsolated: false,
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

  // Auto-scroll log panels
  useEffect(() => {
    if (expandedLog && logRefs.current[expandedLog]) {
      logRefs.current[expandedLog]!.scrollTop = logRefs.current[expandedLog]!.scrollHeight;
    }
  });

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

  // Real deploy via SSE
  const deployApp = useCallback((app: AppDeployState) => {
    return new Promise<void>((resolve) => {
      setDeployStates((prev) =>
        prev.map((s) =>
          s.appId === app.appId
            ? { ...s, status: 'building' as DeployStatus, startedAt: Date.now(), logs: [], error: null }
            : s
        )
      );

      // Route to Isolated Release API if requested
      if (app.isIsolated) {
        const url = `${API_URL}/api/releases/run?appId=${app.appId}&ref=${app.releaseRef}&env=${app.environment}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setDeployStates((prev) =>
            prev.map((s) => {
              if (s.appId !== app.appId) return s;
              const newLogs = [...s.logs];
              if (data.message) newLogs.push(`\n── ${data.message}`);
              
              return {
                ...s,
                status: (data.type === 'success' ? 'live' : data.type === 'error' ? 'failed' : s.status) as DeployStatus,
                logs: newLogs,
                error: data.type === 'error' ? data.message : s.error,
              };
            })
          );

          if (data.type === 'success' || data.type === 'error') {
            eventSource.close();
            resolve();
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          resolve();
        };
        return;
      }

      // Existing standard deploy logic...
      fetch(`${API_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.appId,
          projectPath: app.projectPath,
          hostingTarget: app.hostingTarget,
          project: app.project,
          deployMethod: app.deployMethod,
        }),
      })
        .then(async (response) => {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response stream');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const data = JSON.parse(line.slice(6));
                setDeployStates((prev) =>
                  prev.map((s) => {
                    if (s.appId !== app.appId) return s;
                    const newLogs = [...s.logs];
                    if (data.output) newLogs.push(data.output);
                    if (data.message) newLogs.push(`\n── ${data.message}`);

                    return {
                      ...s,
                      status: (data.stage || s.status) as DeployStatus,
                      logs: newLogs,
                      elapsed: data.duration || s.elapsed,
                      deployUrl: data.url || s.deployUrl,
                      error: data.error || s.error,
                    };
                  })
                );
              } catch {
                // skip malformed events
              }
            }
          }
          // Stream ended — read final state and persist to Firestore
          setDeployStates((prev) => {
            const final = prev.find((s) => s.appId === app.appId);
            if (final && currentSuite) {
              saveDeployRecord({
                suiteId: currentSuite.id,
                batchId: app.appId + '-' + Date.now(),
                appId: app.appId,
                displayName: app.displayName,
                environment: app.environment,
                status: final.status,
                startedAt: app.startedAt || Date.now(),
                duration: final.elapsed || null,
                deployMethod: app.deployMethod,
                hostingTarget: app.hostingTarget,
                project: app.project,
                errorLogs: final.error,
                deployUrl: final.deployUrl,
              }).catch((e) => console.warn('[Deploy] Firestore write failed:', e.message));

              if (final.status === 'live') {
                updateAppStatus(currentSuite.id, app.appId, app.environment, 'live')
                  .catch(e => console.warn('[Deploy] Registry status update failed:', e.message));
              }
            }
            return prev;
          });
          resolve();
        })
        .catch((err) => {
          setDeployStates((prev) =>
            prev.map((s) =>
              s.appId === app.appId
                ? {
                    ...s,
                    status: 'failed' as DeployStatus,
                    error: `API error: ${err.message}`,
                    logs: [...s.logs, `\n── ERROR: ${err.message}`],
                  }
                : s
            )
          );
          // Persist failure record
          if (currentSuite) {
            saveDeployRecord({
              suiteId: currentSuite.id,
              batchId: app.appId + '-' + Date.now(),
              appId: app.appId,
              displayName: app.displayName,
              environment: app.environment,
              status: 'failed',
              startedAt: app.startedAt || Date.now(),
              duration: null,
              deployMethod: app.deployMethod,
              hostingTarget: app.hostingTarget,
              project: app.project,
              errorLogs: err.message,
              deployUrl: null,
            }).catch(() => {});
          }
          resolve();
        });
    });
  }, [currentSuite, user]);

  // Rollback — fetch last versionName then POST /api/rollback
  const rollbackApp = useCallback(async (app: AppDeployState) => {
    if (!app.hostingTarget || !apiAvailable) return;

    setRollbackStates((prev) => ({
      ...prev,
      [app.appId]: { active: true, stage: 'fetching', message: 'Fetching latest release...' },
    }));

    try {
      // 1. Get the second-most-recent release (index 1 = previous deploy)
      const relRes = await fetch(`${API_URL}/api/releases/${app.hostingTarget}?project=${app.project}`);
      const relData = await relRes.json();
      const releases: Array<{ versionName?: string; releaseId: string }> = relData.releases || [];

      if (releases.length < 2) {
        setRollbackStates((prev) => ({
          ...prev,
          [app.appId]: { active: false, stage: 'failed', message: 'No previous release to roll back to' },
        }));
        return;
      }

      const target = releases[1]; // [0] = current, [1] = previous
      if (!target.versionName) {
        setRollbackStates((prev) => ({
          ...prev,
          [app.appId]: { active: false, stage: 'failed', message: 'Previous release has no version data' },
        }));
        return;
      }

      setRollbackStates((prev) => ({
        ...prev,
        [app.appId]: { active: true, stage: 'rolling-back', message: `Rolling back to ${target.releaseId}...` },
      }));

      // 2. Stream rollback
      const rbRes = await fetch(`${API_URL}/api/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostingTarget: app.hostingTarget,
          versionName: target.versionName,
          project: app.project,
        }),
      });

      const reader = rbRes.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            setRollbackStates((prev) => ({
              ...prev,
              [app.appId]: {
                active: data.stage !== 'live' && data.stage !== 'failed',
                stage: data.stage,
                message: data.message || prev[app.appId]?.message,
                error: data.error,
                url: data.url,
              },
            }));
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rollback failed';
      setRollbackStates((prev) => ({
        ...prev,
        [app.appId]: { active: false, stage: 'failed', message: msg },
      }));
    }
  }, [apiAvailable]);

  // Batch deploy — stagger by 1s
  const startBatch = useCallback(async () => {
    const selected = deployStates.filter((s) => s.selected);
    if (selected.length === 0) return;

    setBatchRunning(true);

    // Deploy sequentially to avoid overloading
    for (const app of selected) {
      await deployApp(app);
    }

    setBatchRunning(false);
  }, [deployStates, deployApp]);

  const cancelAppDeployment = async (appId: string) => {
    const app = deployStates.find(s => s.appId === appId);
    if (!app) return;

    try {
      if (app.isIsolated) {
        await fetch(`${API_URL}/api/releases/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId })
        });
      } else {
        // Standard cancellation is handled by AbortController in deploy-api
        // but we don't have a specific endpoint for it yet beyond backups.
        // For now, isolated releases are the main target for cancellation.
      }
    } catch (err) {
      console.error('Failed to cancel deployment:', err);
    }
  };

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
          {/* API Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
            apiAvailable === null ? 'text-white/30 bg-white/5' :
            apiAvailable ? 'text-green-400 bg-green-400/10' : 'text-amber-400 bg-amber-400/10'
          }`}>
            {apiAvailable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {apiAvailable === null ? 'Checking...' : apiAvailable ? 'API Live' : 'API Offline'}
          </div>
          <button onClick={toggleSelectAll} className="btn-ghost text-xs">
            {deployStates.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={startBatch}
            disabled={selectedCount === 0 || batchRunning || !apiAvailable}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Rocket className="w-4 h-4" />
            {batchRunning ? 'Deploying...' : `Deploy (${selectedCount})`}
          </button>
        </div>
      </div>

      {/* API Offline Warning */}
      {apiAvailable === false && (
        <div className="glass-card-static p-4 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white/80 font-medium">Deploy API not running</p>
            <p className="text-xs text-white/40 mt-1">
              Start it with: <code className="bg-white/10 px-2 py-0.5 rounded text-primary font-mono">npm run dev:api</code>
              {' '}or use <code className="bg-white/10 px-2 py-0.5 rounded text-primary font-mono">npm run dev:all</code> to run both UI and API.
            </p>
          </div>
        </div>
      )}

      {/* App Grid */}
      <div className="space-y-3">
        {deployStates.map((app) => {
          const estimate = getEstimate(app.appId, app.deployMethod as 'firebase' | 'cloud-build', deployHistory);
          const isExpanded = expandedLog === app.appId;

          return (
            <div
              key={app.appId}
              className={`glass-card-static overflow-hidden transition-all ${
                app.selected ? 'border-primary/30' : ''
              }`}
            >
              <div className="p-4">
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(app.appId)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                      app.selected
                        ? 'bg-primary border-primary text-white'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {app.selected && <CheckCircle2 className="w-3 h-3" />}
                  </button>

                  {/* App Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white/90">{app.displayName}</h3>
                      <StatusBadge status={app.status} />
                      {app.hostingTarget && (
                        <a
                          href={app.deployUrl || `https://${app.hostingTarget}.web.app`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-white/20 hover:text-primary transition-colors"
                          title={`https://${app.hostingTarget}.web.app`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="hidden lg:inline">{app.hostingTarget}.web.app</span>
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 font-mono mt-0.5 truncate">
                      {app.projectPath} → {app.hostingTarget || 'cloud-build'}
                    </p>
                  </div>

                  {/* Environment Selector */}
                  <div className="relative">
                    <select
                      value={app.environment}
                      onChange={(e) => setEnvironment(app.appId, e.target.value as EnvironmentTag)}
                      className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white/70 pr-8 cursor-pointer focus:border-primary/50 outline-none"
                    >
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="dev">Dev</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>

                  {/* Estimate */}
                  <div className="text-right shrink-0 hidden md:block">
                    <p className="text-[10px] text-white/20 uppercase tracking-wider">Est.</p>
                    <p className="text-xs font-mono text-white/50">{formatDuration(estimate.estimatedDuration)}</p>
                  </div>

                  {/* Elapsed / Timer */}
                  {app.startedAt && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-white/20 uppercase tracking-wider">Elapsed</p>
                      <p className="text-xs font-mono text-primary">{formatElapsed(app.elapsed)}</p>
                    </div>
                  )}

                  {/* Active Operation Controls */}
                  {(app.status === 'building' || app.status === 'deploying') && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => cancelAppDeployment(app.appId)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Cancel Deployment"
                      >
                        <Square className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  )}

                  {/* Log toggle */}
                  {app.logs.length > 0 && (
                    <button
                      onClick={() => setExpandedLog(isExpanded ? null : app.appId)}
                      className={`p-2 rounded-lg transition-colors ${
                        isExpanded ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/30 hover:text-white/60'
                      }`}
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                  )}

                  {/* Rollback quick-action */}
                  {apiAvailable && app.hostingTarget && !batchRunning && app.status !== 'building' && app.status !== 'deploying' && (() => {
                    const rb = rollbackStates[app.appId];
                    if (rb?.active) {
                      return (
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="hidden lg:inline">{rb.message}</span>
                        </div>
                      );
                    }
                    if (rb?.stage === 'live') {
                      return (
                        <div className="flex items-center gap-1.5 text-green-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {rb.url && (
                            <a href={rb.url} target="_blank" rel="noopener noreferrer" className="hidden lg:inline underline">
                              Rolled back ↗
                            </a>
                          )}
                        </div>
                      );
                    }
                    if (rb?.stage === 'failed') {
                      return (
                        <div className="flex items-center gap-1.5 text-red-400 text-xs" title={rb.message}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Failed</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        onClick={() => rollbackApp(app)}
                        title="Roll back to previous release"
                        className="p-2 rounded-lg bg-white/5 hover:bg-cyan-400/10 text-white/20 hover:text-cyan-400 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    );
                  })()}

                  {/* Deploy URL */}
                  {app.deployUrl && (
                    <a
                      href={app.deployUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Progress Bar */}
                {(app.status === 'building' || app.status === 'deploying') && (
                  <div className="mt-3">
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          app.status === 'building'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-primary animate-pulse'
                        }`}
                        style={{
                          width: `${Math.min(
                            (app.elapsed / estimate.estimatedDuration) * 100,
                            95
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        {app.status === 'building' ? '🔨 Building...' : '🚀 Deploying...'}
                      </span>
                      <span className="text-[10px] text-white/30 font-mono">
                        {formatElapsed(app.elapsed)} / ~{formatDuration(estimate.estimatedDuration)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {app.error && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">{app.error}</p>
                  </div>
                )}
              </div>

              {/* Advanced Config Row (Only when selected) */}
              {app.selected && !batchRunning && (
                <div className="px-4 pb-4 pt-0 flex items-center gap-6 border-t border-white/5 bg-white/5 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Release Ref</span>
                    <input 
                      type="text" 
                      value={app.releaseRef}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDeployStates(prev => prev.map(s => s.appId === app.appId ? { ...s, releaseRef: val } : s));
                      }}
                      placeholder="main"
                      className="bg-black/40 border-white/10 rounded-lg px-2 py-1 text-xs text-white w-32 focus:ring-primary/50"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={app.isIsolated}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setDeployStates(prev => prev.map(s => s.appId === app.appId ? { ...s, isIsolated: val } : s));
                      }}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/60 group-hover:text-white transition-colors">Isolated Build</span>
                      <span className="text-[8px] text-white/20 uppercase tracking-tighter">Uses Git Worktree</span>
                    </div>
                  </label>
                </div>
              )}

              {/* Expandable Log Panel */}
              {isExpanded && app.logs.length > 0 && (
                <div
                  ref={(el) => { logRefs.current[app.appId] = el; }}
                  className="border-t border-white/5 bg-black/40 p-4 max-h-64 overflow-y-auto font-mono text-[11px] text-white/50 leading-relaxed"
                >
                  {app.logs.map((line, i) => (
                    <div key={i} className={line.startsWith('\n──') ? 'text-primary font-bold mt-2' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Batch Summary */}
      {(successCount > 0 || failCount > 0) && (
        <div className="glass-card-static p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {successCount > 0 && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-bold">{successCount} Deployed</span>
              </div>
            )}
            {failCount > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-bold">{failCount} Failed</span>
              </div>
            )}
          </div>
          {batchRunning && (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">Batch in progress...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live: 'badge-success',
    building: 'badge-warning',
    deploying: 'badge-warning',
    failed: 'badge-danger',
    queued: 'badge-info',
    'not-configured': 'badge-info',
  };

  const icons: Record<string, React.ReactNode> = {
    live: <CheckCircle2 className="w-3 h-3" />,
    building: <Loader2 className="w-3 h-3 animate-spin" />,
    deploying: <Loader2 className="w-3 h-3 animate-spin" />,
    failed: <AlertTriangle className="w-3 h-3" />,
    queued: <Clock className="w-3 h-3" />,
  };

  return (
    <span className={`badge ${styles[status] || 'badge-info'} flex items-center gap-1`}>
      {icons[status]}
      {status}
    </span>
  );
}
