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
  Calendar,
  History,
  Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
  lastDeployAt: number | null;
  appVersion?: string;
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
  const [sortBy, setSortBy] = useState<'name' | 'last-deploy'>('last-deploy');

  // Check API health on mount
  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((r) => r.ok ? setApiAvailable(true) : setApiAvailable(false))
      .catch(() => setApiAvailable(false));
  }, []);

  // Fetch app versions from health scanner
  useEffect(() => {
    if (apiAvailable !== true || deployStates.length === 0) return;
    
    const fetchVersions = () => {
      fetch(`${API_URL}/api/health`)
        .then(res => res.json())
        .then((healthResults: any[]) => {
          setDeployStates(prev => prev.map(s => {
            const health = healthResults.find(h => h.appId === s.appId);
            return health && health.appVersion ? { ...s, appVersion: health.appVersion } : s;
          }));
        })
        .catch(err => console.error('Failed to fetch app versions:', err));
    };

    fetchVersions();
    // Refresh versions every 30s to catch updates
    const interval = setInterval(fetchVersions, 30000);
    return () => clearInterval(interval);
  }, [apiAvailable, deployStates.length]);

  // Subscribe to Firestore deploy history for this suite (feeds expert system)
  useEffect(() => {
    if (!currentSuite) return;
    const unsub = subscribeToDeployHistory(
      currentSuite.id,
      (records) => setDeployHistory(records),
    );
    return () => unsub();
  }, [currentSuite]);

  // Initialize/Sync deploy states from suite apps
  useEffect(() => {
    if (!currentSuite) return;

    setDeployStates((prev) => {
      return Object.entries(currentSuite.apps).map(([id, app]) => {
        const existing = prev.find((s) => s.appId === id);
        const dbStatus = (app.environments.production?.status || 'queued') as DeployStatus;
        const dbUrl = app.environments.production?.deployUrl || null;

        // If we are already tracking this app and it's in an active local state,
        // don't let the DB status overwrite our local progress/logs unless the DB 
        // says it's finished (live/failed).
        if (existing && (existing.status === 'building' || existing.status === 'deploying' || existing.status === 'verifying')) {
           if (dbStatus === 'live' || dbStatus === 'failed') {
             return { ...existing, status: dbStatus, deployUrl: dbUrl };
           }
           return existing;
        }

        const lastDeploy = app.environments.production?.lastDeployAt;
        const lastDeployMillis = lastDeploy ? (typeof lastDeploy.toMillis === 'function' ? lastDeploy.toMillis() : (lastDeploy.seconds * 1000)) : null;

        return {
          appId: id,
          displayName: app.displayName,
          selected: existing?.selected || false,
          environment: existing?.environment || ('production' as EnvironmentTag),
          status: dbStatus,
          startedAt: existing?.startedAt || null,
          elapsed: existing?.elapsed || 0,
          deployMethod: app.environments.production?.deployMethod || 'firebase',
          projectPath: app.path,
          hostingTarget: app.environments.production?.hostingTarget || null,
          project: app.project || 'heidless-apps-0',
          logs: existing?.logs || [],
          deployUrl: dbUrl,
          error: existing?.error || null,
          releaseRef: existing?.releaseRef || 'main',
          isIsolated: existing?.isIsolated || false,
          lastDeployAt: lastDeployMillis,
        };
      });
    });
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

  const deployIndividual = async (appId: string) => {
    const app = deployStates.find(s => s.appId === appId);
    if (!app || batchRunning) return;
    
    setExpandedLog(appId);
    setBatchRunning(true);
    try {
      await deployApp(app);
    } finally {
      setBatchRunning(false);
    }
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
        headers: { 
          'Content-Type': 'application/json',
          'x-workspace-id': currentSuite?.id || 'stillwater-suite'
        },
        body: JSON.stringify({
          appId: app.appId,
          projectPath: app.projectPath,
          hostingTarget: app.hostingTarget,
          displayName: app.displayName,
          project: app.project,
          deployMethod: app.deployMethod,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
          }
          
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
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
              
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                setDeployStates((prev) =>
                  prev.map((s) => {
                    if (s.appId !== app.appId) return s;
                    const newLogs = [...s.logs];
                    if (data.output) newLogs.push(data.output);
                    if (data.message) newLogs.push(`\n── ${data.message}`);

                    if (data.stage === 'failed') {
                      setExpandedLog(app.appId);
                    }

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
              } catch (e) {
                console.warn('[Deploy] Failed to parse SSE event:', trimmedLine, e);
              }
            }
          }
          // Stream ended — state is already persisted by backend
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

  const sortedStates = [...deployStates].sort((a, b) => {
    if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
    if (sortBy === 'last-deploy') {
      const timeA = a.lastDeployAt || 0;
      const timeB = b.lastDeployAt || 0;
      return timeB - timeA;
    }
    return 0;
  });

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

          {/* Sort Controls */}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 ml-2">
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                sortBy === 'name' ? 'bg-primary text-white shadow-lg' : 'text-white/30 hover:text-white/60'
              }`}
            >
              By Name
            </button>
            <button
              onClick={() => setSortBy('last-deploy')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                sortBy === 'last-deploy' ? 'bg-primary text-white shadow-lg' : 'text-white/30 hover:text-white/60'
              }`}
            >
              By Last Deployed
            </button>
          </div>
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
        {sortedStates.map((app) => {
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
                      {app.appVersion && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px] font-mono text-primary font-bold">
                          v{app.appVersion}
                        </span>
                      )}
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
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[11px] text-white/30 font-mono truncate">
                        {app.projectPath} → {app.hostingTarget || 'cloud-build'}
                      </p>
                      {app.lastDeployAt && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 shadow-inner">
                          <Calendar className="w-2.5 h-2.5 text-white/20" />
                          <span className="text-[10px] text-white/40 font-medium whitespace-nowrap">
                            {app.status === 'live' ? 'Deployed' : 'Attempted'} {formatDistanceToNow(new Date(app.lastDeployAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                    </div>
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
                  <div className="text-right shrink-0 hidden md:block group/est cursor-help relative">
                    <p className="text-[10px] text-white/20 uppercase tracking-wider">Est.</p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <p className="text-xs font-mono text-white/50">{formatDuration(estimate.estimatedDuration)}</p>
                      {estimate.confidence > 0.7 ? (
                        <Zap className="w-2.5 h-2.5 text-amber-400/50" />
                      ) : (
                        <Info className="w-2.5 h-2.5 text-white/10" />
                      )}
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover/est:opacity-100 transition-all pointer-events-none z-50 scale-95 group-hover/est:scale-100 origin-bottom-right">
                       <div className="flex items-center gap-2 mb-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                         <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 text-left">Smart Estimate</span>
                       </div>
                       <p className="text-[10px] leading-relaxed text-white/50 text-left">{estimate.reasoning}</p>
                       <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                         <span className="text-[9px] text-white/30 uppercase tracking-tighter">Confidence</span>
                         <div className="flex items-center gap-1">
                           <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-primary" 
                               style={{ width: `${estimate.confidence * 100}%` }}
                             />
                           </div>
                           <span className="text-[9px] font-mono text-primary">{Math.round(estimate.confidence * 100)}%</span>
                         </div>
                       </div>
                    </div>
                  </div>

                  {/* Elapsed / Timer */}
                  {app.startedAt && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-white/20 uppercase tracking-wider">Elapsed</p>
                      <p className="text-xs font-mono text-primary">{formatElapsed(app.elapsed)}</p>
                    </div>
                  )}

                  {/* Individual Deploy Button */}
                  {!batchRunning && app.status !== 'building' && app.status !== 'deploying' && (
                    <button
                      onClick={() => deployIndividual(app.appId)}
                      className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all group/btn border border-primary/20"
                      title="Deploy this app now"
                    >
                      <Rocket className="w-4 h-4 group-hover/btn:animate-bounce" />
                    </button>
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
              {/* Expandable Log Panel & History */}
              {isExpanded && (
                <div className="border-t border-white/5">
                  <div
                    ref={(el) => { logRefs.current[app.appId] = el; }}
                    className="bg-black/40 p-4 h-[300px] overflow-y-auto overflow-x-hidden font-mono text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap break-words"
                  >
                    {app.logs.map((line, i) => (
                      <div key={i} className={line.startsWith('\n──') ? 'text-primary font-bold mt-2' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>

                  {/* History Section */}
                  <div className="border-t border-white/5 bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                        <History className="w-3 h-3" />
                        Recent Deployment History
                      </h4>
                      <span className="text-[9px] text-white/10">Showing last 5 attempts</span>
                    </div>
                    <div className="space-y-1">
                      {deployHistory
                        .filter(h => h.appId === app.appId)
                        .slice(0, 5)
                        .map((h) => (
                          <div key={h.id} className="flex items-center justify-between text-[10px] py-1.5 border-b border-white/[0.02] last:border-0 group/hist">
                            <div className="flex items-center gap-3">
                              <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'live' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`} />
                              <span className="text-white/40 group-hover/hist:text-white/60 transition-colors">
                                {h.completedAt ? formatDistanceToNow(h.completedAt.toDate(), { addSuffix: true }) : 'Recently'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-mono text-white/30 group-hover/hist:text-white/50">
                                {h.duration ? formatDuration(h.duration) : '—'}
                              </span>
                              <span className="text-white/10 text-[9px] uppercase tracking-tighter">{h.deployMethod}</span>
                            </div>
                          </div>
                        ))}
                      {deployHistory.filter(h => h.appId === app.appId).length === 0 && (
                        <div className="text-center py-6 border border-dashed border-white/5 rounded-xl">
                          <p className="text-white/10 text-[10px] italic">No historical data found for this app.</p>
                        </div>
                      )}
                    </div>
                  </div>
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
    verifying: 'badge-warning',
    failed: 'badge-danger',
    queued: 'badge-info',
    'not-configured': 'badge-info',
  };

  const icons: Record<string, React.ReactNode> = {
    live: <CheckCircle2 className="w-3 h-3" />,
    building: <Loader2 className="w-3 h-3 animate-spin" />,
    deploying: <Loader2 className="w-3 h-3 animate-spin" />,
    verifying: <Loader2 className="w-3 h-3 animate-spin" />,
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
