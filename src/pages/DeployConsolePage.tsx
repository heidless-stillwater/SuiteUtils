import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Rocket, 
  RotateCcw, 
  Terminal, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Ban,
  Loader2,
  AlertTriangle,
  Info,
  Globe,
  Check,
  Database,
  GripVertical
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ActionModal } from '../components/common/ActionModal';
import { saveDeployRecord, subscribeToDeployHistory } from '../lib/deployment-service';
import type { DeployStatus, EnvironmentTag, DeploymentRecord } from '../lib/types';
import { getEstimate, formatDuration, formatElapsed } from '../lib/expert-system';
import { API_URL } from '../lib/api-config';
import { parseDate } from '../lib/utils';

interface AppDeployState {
  appId: string;
  displayName: string;
  status: DeployStatus;
  logs: string[];
  elapsed: number;
  environment: EnvironmentTag;
  releaseRef: string;
  isIsolated: boolean;
  projectPath: string;
  hostingTarget: string | null;
  project?: string;
  deployMethod?: 'firebase' | 'cloud-run' | 'vercel';
  deployUrl?: string;
  error?: string | null;
  startedAt?: number;
  lastUpdated?: string;
}

interface DeployResult {
  appId: string;
  displayName: string;
  status: 'live' | 'failed';
  duration: number;
  targetProject: string;
  targetEmail: string;
  url?: string;
  error?: string;
  logs?: string[];
}

export function DeployConsolePage() {
  const { currentSuite, updateAppStatus } = useSuite();
  const { activeWorkspaceId, availableWorkspaces } = useWorkspace();
  
  const activeWorkspace = availableWorkspaces.find(w => w.id === activeWorkspaceId);
  const targetProject = activeWorkspace?.gcpProjectId || currentSuite?.gcpProjectId || 'heidless-apps-2';
  const targetEmail = activeWorkspace?.ownerEmail || currentSuite?.ownerEmail;

  const { user } = useAuth();
  const [deployStates, setDeployStates] = useState<AppDeployState[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentTag>('production');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [deployHistory, setDeployHistory] = useState<DeploymentRecord[]>([]);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'deploy' | 'rollback';
    app: any;
  }>({
    isOpen: false,
    type: 'deploy',
    app: null
  });

  // Per-app rollback state: stage | message | error | url
  const [rollbackStates, setRollbackStates] = useState<Record<string, { active: boolean; stage: string; message: string; error?: string; url?: string }>>({});
  const [sortBy, setSortBy] = useState<'name' | 'last-deploy' | 'custom'>('custom');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [appOrder, setAppOrder] = useState<string[]>([]);

  // Initialize/Sync deploy states from suite config AND workspace registry
  useEffect(() => {
    // We want to combine apps from both the Firestore Suite AND the Backend Workspace
    const suiteApps = (currentSuite?.apps || {}) as Record<string, any>;
    const workspaceApps = activeWorkspace?.apps || [];
    
    setDeployStates(prev => {
      // 1. Start with apps defined in the workspace registry (Backend Authority)
      const initialStates: AppDeployState[] = workspaceApps.map((wApp: any) => {
        const sApp = suiteApps[wApp.id] || {};
        const prod = sApp.environments?.production;
        const existing = prev.find(s => s.appId === wApp.id);
        
        const isRunning = existing && (
          existing.status === 'building' || 
          existing.status === 'deploying' || 
          existing.status === 'verifying' || 
          existing.status === 'queued'
        );

        return {
          appId: wApp.id,
          displayName: wApp.name || sApp.displayName || wApp.id,
          status: isRunning ? existing.status : ((prod?.status as DeployStatus) || 'stopped'),
          logs: isRunning ? existing.logs : [],
          elapsed: isRunning ? existing.elapsed : 0,
          environment: 'production',
          releaseRef: 'main',
          isIsolated: false,
          projectPath: wApp.projectPath || sApp.path || `~/projects/${wApp.id}`,
          hostingTarget: wApp.hostingTarget || prod?.hostingTarget || null,
          project: sApp.project || targetProject,
          deployMethod: (wApp.deployMethod || prod?.deployMethod || 'firebase') as any,
          lastUpdated: prod?.lastUpdated || null,
          startedAt: isRunning ? existing.startedAt : undefined,
          deployUrl: isRunning ? existing.deployUrl : undefined
        };
      });

      // 2. Add apps that are in the suite but NOT in the workspace (Legacy/Orphaned)
      Object.entries(suiteApps).forEach(([id, sApp]: [string, any]) => {
        if (!initialStates.some(s => s.appId === id)) {
          const prod = sApp.environments?.production;
          initialStates.push({
            appId: id,
            displayName: sApp.displayName || id,
            status: (prod?.status as DeployStatus) || 'stopped',
            logs: [],
            elapsed: 0,
            environment: 'production',
            releaseRef: 'main',
            isIsolated: false,
            projectPath: sApp.path || `~/projects/${id}`,
            hostingTarget: prod?.hostingTarget || null,
            project: sApp.project || targetProject,
            deployMethod: (prod?.deployMethod || 'firebase') as any,
            lastUpdated: prod?.lastUpdated || null,
          });
        }
      });

      // Initialize/Load custom order
      const savedOrder = localStorage.getItem(`deploy_order_${activeWorkspaceId}`);
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        const validOrder = parsedOrder.filter((id: string) => initialStates.some(s => s.appId === id));
        const newApps = initialStates.filter(s => !validOrder.includes(s.appId)).map(s => s.appId);
        setAppOrder([...validOrder, ...newApps]);
      } else if (appOrder.length === 0) {
        setAppOrder(initialStates.map(s => s.appId));
      }

      return initialStates;
    });
  }, [currentSuite?.apps, activeWorkspace, activeWorkspaceId, targetProject]);

  // Persist order changes
  useEffect(() => {
    if (appOrder.length > 0) {
      localStorage.setItem(`deploy_order_${activeWorkspaceId}`, JSON.stringify(appOrder));
    }
  }, [appOrder, activeWorkspaceId]);


  // Subscribe to history
  useEffect(() => {
    if (!currentSuite?.id) return;
    return subscribeToDeployHistory(currentSuite.id, setDeployHistory);
  }, [currentSuite?.id]);

  // Derive batchRunning from active jobs
  const isBatchActive = useMemo(() => {
    return deployStates.some(s => 
      s.status === 'building' || 
      s.status === 'deploying' || 
      s.status === 'verifying' || 
      s.status === 'queued'
    );
  }, [deployStates]);

  // Sync batchRunning state for backward compatibility with UI components
  useEffect(() => {
    setBatchRunning(isBatchActive);
  }, [isBatchActive]);

  // RECOVERY: Fetch active jobs on mount and re-attach streams
  useEffect(() => {
    const recoverJobs = async () => {
      try {
        const response = await fetch(`${API_URL}/api/deploy/active`);
        if (!response.ok) return;
        const activeJobs = await response.json();
        
        activeJobs.forEach((job: any) => {
          const app = deployStates.find(s => s.appId === job.appId);
          if (!app) return;

          // Only recover if the job is actually still in progress
          const isRunning = job.status === 'building' || job.status === 'deploying' || job.status === 'verifying';
          if (!isRunning) return;

          // Update state with job info and start streaming
          const elapsed = Math.floor((Date.now() - job.startedAt) / 1000);
          setDeployStates(prev => prev.map(s => 
            s.appId === job.appId 
              ? { ...s, status: job.status, startedAt: job.startedAt, logs: job.logs, elapsed }
              : s
          ));

          attachToStream(job.id, job.appId);
        });
      } catch (err) {
        console.error('Failed to recover jobs:', err);
      }
    };

    if (deployStates.length > 0) {
      recoverJobs();
    }
  }, [deployStates.length === 0]);

  // Attach to an existing SSE stream
  const attachToStream = (jobId: string, appId: string) => {
    const url = `${API_URL}/api/deploy/${jobId}/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setDeployStates((prev) =>
        prev.map((s) => {
          if (s.appId !== appId) return s;
          
          const newLogs = data.output ? [...s.logs, data.output] : s.logs;
          const currentElapsed = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : (s.elapsed || 0);

          return {
            ...s,
            status: (data.stage || s.status) as DeployStatus,
            logs: newLogs,
            startedAt: data.startedAt || s.startedAt,
            elapsed: data.duration || (data.startedAt ? Math.floor((Date.now() - data.startedAt) / 1000) : currentElapsed),
            deployUrl: data.url || s.deployUrl,
            error: data.error || s.error,
          };
        })
      );

      if (data.stage === 'live' || data.stage === 'failed') {
        eventSource.close();
        
        setDeployStates(prev => {
          const app = prev.find(s => s.appId === appId);
          setDeployResult({
            appId,
            displayName: app?.displayName || appId,
            status: data.stage as 'live' | 'failed',
            duration: data.duration || 0,
            targetProject,
            targetEmail: targetEmail || 'unknown',
            url: data.url,
            error: data.error,
            logs: app?.logs || []
          });
          return prev;
        });
      }
    };

    eventSource.onerror = () => eventSource.close();
  };

  // Elapsed time updater
  useEffect(() => {
    const interval = setInterval(() => {
      setDeployStates((prev) =>
        prev.map((s) => {
          if (s.status === 'building' || s.status === 'deploying' || s.status === 'verifying') {
            return { ...s, elapsed: (s.elapsed || 0) + 1 };
          }
          return s;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateAppState = (appId: string, env: EnvironmentTag) => {
    setDeployStates((prev) =>
      prev.map((s) => (s.appId === appId ? { ...s, environment: env } : s))
    );
  };

  const handleConfirmAction = () => {
    if (!modalConfig.app) return;
    
    if (modalConfig.type === 'deploy') {
      deployApp(modalConfig.app);
    } else {
      rollbackApp(modalConfig.app);
    }
    
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Real deploy via SSE
  const deployApp = useCallback((app: AppDeployState) => {
    return new Promise<void>((resolve) => {
      setExpandedLog(app.appId);
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
              if (data.output) newLogs.push(data.output);

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

          if (data.stage === 'live' || data.stage === 'failed') {
            eventSource.close();
            resolve();
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE Error:', err);
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
            const errorData = await response.json();
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
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

              try {
                const data = JSON.parse(trimmedLine.slice(6));
                setDeployStates((prev) =>
                  prev.map((s) => {
                    if (s.appId !== app.appId) return s;
                    
                    const newLogs = data.output ? [...s.logs, data.output] : s.logs;
                    
                    if (data.stage === 'live' || data.stage === 'failed') {
                      setDeployResult({
                        appId: app.appId,
                        displayName: app.displayName,
                        status: data.stage as 'live' | 'failed',
                        duration: data.duration || 0,
                        targetProject,
                        targetEmail: targetEmail || 'unknown',
                        url: data.url,
                        error: data.error,
                        logs: s.logs
                      });
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
                // Ignore parse errors
              }
            }
          }
          resolve();
        })
        .catch((err) => {
          console.error('Fetch Error:', err);
          setDeployStates((prev) =>
            prev.map((s) =>
              s.appId === app.appId ? { ...s, status: 'failed', error: err.message } : s
            )
          );
          setDeployResult({
            appId: app.appId,
            displayName: app.displayName,
            status: 'failed',
            duration: 0,
            targetProject,
            targetEmail: targetEmail || 'unknown',
            error: err.message,
            logs: app.logs
          });
          resolve();
        });
    });
  }, [currentSuite?.id, targetProject, targetEmail]);

  const rollbackApp = async (app: AppDeployState) => {
    setRollbackStates(prev => ({ 
      ...prev, 
      [app.appId]: { active: true, stage: 'initializing', message: 'Starting rollback...' } 
    }));

    try {
      const response = await fetch(`${API_URL}/api/deploy/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.appId,
          projectPath: app.projectPath,
          hostingTarget: app.hostingTarget,
          project: app.project
        })
      });

      if (!response.ok) throw new Error('Rollback request failed');
      
      const data = await response.json();
      setRollbackStates(prev => ({ 
        ...prev, 
        [app.appId]: { active: false, stage: 'live', message: 'Rolled back', url: data.url } 
      }));

    } catch (err: any) {
      setRollbackStates(prev => ({ 
        ...prev, 
        [app.appId]: { active: false, stage: 'failed', message: err.message } 
      }));
    }
  };

  const cancelAppDeployment = async (appId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/deploy/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });

      if (!response.ok) throw new Error('Cancel failed');
      
      setDeployStates(prev => prev.map(s => s.appId === appId ? { ...s, status: 'failed', error: 'Cancelled by user' } : s));
    } catch (err) {
      console.error('Failed to cancel deployment:', err);
    }
  };

  const toggleSelect = (appId: string) => {
    const next = new Set(selectedAppIds);
    if (next.has(appId)) next.delete(appId);
    else next.add(appId);
    setSelectedAppIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedAppIds.size === deployStates.length) {
      setSelectedAppIds(new Set());
    } else {
      setSelectedAppIds(new Set(deployStates.map(s => s.appId)));
    }
  };

  const deploySelected = async () => {
    if (selectedAppIds.size === 0 || batchRunning) return;
    
    setBatchRunning(true);
    // Sequence them based on the current visible order
    const sequence = appOrder.filter(id => selectedAppIds.has(id));
    
    for (const appId of sequence) {
      const app = deployStates.find(s => s.appId === appId);
      if (app) {
        await deployApp(app);
      }
    }
    setSelectedAppIds(new Set());
  };

  const sortedApps = useMemo(() => {
    const apps = [...deployStates].filter(app => 
      app.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.appId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'custom' && appOrder.length > 0) {
      return apps.sort((a, b) => appOrder.indexOf(a.appId) - appOrder.indexOf(b.appId));
    }

    return apps.sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      if (sortBy === 'last-deploy') {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });
  }, [deployStates, sortBy, appOrder, searchQuery]);


  // Scroll logs to bottom
  useEffect(() => {
    Object.values(logRefs.current).forEach(ref => {
      if (ref) ref.scrollTop = ref.scrollHeight;
    });
  }, [deployStates]);

  const filteredApps = React.useMemo(() => {
    return deployStates.filter(app => 
      app.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.appId.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      const lastA = deployHistory.find(h => h.appId === a.appId)?.startedAt?.toMillis() || 0;
      const lastB = deployHistory.find(h => h.appId === b.appId)?.startedAt?.toMillis() || 0;
      return lastB - lastA;
    });
  }, [deployStates, searchQuery, sortBy, deployHistory]);

  // Calculate Batch Metrics
  const batchMetrics = React.useMemo(() => {
    const runningApps = deployStates.filter(s => s.status === 'building' || s.status === 'deploying' || s.status === 'verifying');
    if (runningApps.length === 0) return null;

    const totalEstimated = runningApps.reduce((acc, s) => acc + (getEstimate(s.appId, s.deployMethod || 'firebase', deployHistory).estimatedDuration), 0);
    const totalElapsed = runningApps.reduce((acc, s) => acc + (s.elapsed || 0), 0);
    const progress = Math.min(100, (Number(totalElapsed) / (Number(totalEstimated) || 1)) * 100);
    const earliestStart = Math.min(...runningApps.map(s => Number(s.startedAt) || Date.now()));
    const batchDuration = Math.floor((Date.now() - earliestStart) / 1000);

    return {
      count: runningApps.length,
      totalEstimated,
      totalElapsed,
      progress,
      batchDuration
    };
  }, [deployStates, deployHistory]);

  const apiAvailable = true; // Placeholder

  return (
    <div className="page-enter space-y-6">
      <ActionModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        type={modalConfig.type}
        title={modalConfig.type === 'deploy' ? 'Confirm Deployment' : 'Confirm Rollback'}
        message={
          modalConfig.type === 'deploy'
            ? `You are about to initiate a production build and deployment for ${modalConfig.app?.displayName}. This will trigger a live release.`
            : `You are about to revert ${modalConfig.app?.displayName} to its previous stable version. This action will happen immediately.`
        }
        confirmLabel={modalConfig.type === 'deploy' ? 'Start Deploy' : 'Confirm Rollback'}
        confirmVariant={modalConfig.type === 'rollback' ? 'danger' : 'primary'}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Rocket className="w-6 h-6 text-primary" />
            Deploy Console
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-white/40 text-sm">Manage and monitor suite-wide deployments in real-time.</p>
            <div className="w-1 h-1 rounded-full bg-white/10 mx-1" />
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              <Globe className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">
                {currentSuite?.name || 'Loading...'}
              </span>
              <span className="text-[10px] font-mono text-white/30">
                ({targetProject})
              </span>
            </div>
            {targetEmail && (
              <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                <ShieldCheck className="w-3 h-3 text-white/20" />
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest italic">
                  {targetEmail}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-bold flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {selectedAppIds.size === deployStates.length ? 'Deselect All' : 'Select All'}
          </button>
          
          <button
            onClick={deploySelected}
            disabled={selectedAppIds.size === 0 || batchRunning}
            className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
              selectedAppIds.size > 0 && !batchRunning
                ? 'bg-primary text-black shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
            }`}
          >
            {batchRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            {batchRunning ? 'Deploying Sequence...' : `Deploy Selected (${selectedAppIds.size})`}
          </button>

          <div className="w-[1px] h-8 bg-white/10 mx-1" />

          <button
            onClick={() => subscribeToDeployHistory(currentSuite?.id || '', setDeployHistory)}
            className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white/90 hover:bg-white/10 transition-all"
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Batch Insights Bar */}
      <AnimatePresence>
        {batchMetrics && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative overflow-hidden p-6 rounded-2xl bg-primary/5 border border-primary/20 shadow-xl shadow-primary/5"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Rocket className="w-24 h-24 text-primary rotate-12" />
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Active Jobs</span>
                <div className="text-3xl font-bold text-white mt-1 flex items-baseline gap-2">
                  {batchMetrics.count}
                  <span className="text-xs text-white/20 font-medium">operations</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Workload Estimate</span>
                <div className="text-3xl font-bold text-white mt-1 flex items-baseline gap-2">
                  {formatDuration(batchMetrics.totalEstimated)}
                  <span className="text-xs text-white/20 font-medium">total work</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Batch Elapsed</span>
                <div className="text-3xl font-bold text-white mt-1 flex items-baseline gap-2">
                  {formatElapsed(batchMetrics.batchDuration)}
                  <span className="text-xs text-white/20 font-medium">session time</span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Global Progress</span>
                  <span className="text-xs font-bold text-primary">{Math.round(batchMetrics.progress)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${batchMetrics.progress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Status & Controls Card */}
        <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${apiAvailable ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-bold text-white/60 tracking-wider uppercase">Deploy API: {apiAvailable ? 'Online' : 'Offline'}</span>
            </div>
            
            <div className="h-8 w-[1px] bg-white/10" />

            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-white/20" />
              <input 
                type="text" 
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-white/10 w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={() => {
                if (sortBy === 'name') setSortBy('last-deploy');
                else if (sortBy === 'last-deploy') setSortBy('custom');
                else setSortBy('name');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 text-white/40 hover:text-white/90 transition-all text-xs font-medium"
            >
              <Filter className="w-3.5 h-3.5" />
              Sort: {sortBy === 'name' ? 'Name' : sortBy === 'last-deploy' ? 'Recent' : 'Custom Sequence'}
            </button>
          </div>
        </div>

        {/* App List */}
        <Reorder.Group 
          axis="y" 
          values={appOrder} 
          onReorder={setAppOrder}
          className="lg:col-span-2 space-y-4"
        >
          {sortedApps.map((app) => {
            const isExpanded = expandedLog === app.appId;
            const isSelected = selectedAppIds.has(app.appId);
            const estimate = getEstimate(app.appId, app.deployMethod || 'firebase', deployHistory);
            const progress = estimate ? Math.min(98, (app.elapsed / estimate.estimatedDuration) * 100) : 0;

            return (
              <Reorder.Item 
                value={app.appId}
                key={app.appId}
                dragListener={sortBy === 'custom'}
                className={`relative overflow-hidden bg-white/5 border transition-all cursor-default ${
                  isSelected ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/5' : 'border-white/10'
                } rounded-2xl ${
                  app.status === 'building' || app.status === 'deploying' ? 'ring-1 ring-primary/30' : ''
                }`}
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Select Checkbox & Drag Handle */}
                    <div className="flex items-center gap-2">
                      {sortBy === 'custom' && (
                        <div className="cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/60 transition-colors">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}
                      <button
                        onClick={() => toggleSelect(app.appId)}
                        className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/10 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" strokeWidth={4} />
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl ${
                      app.status === 'live' ? 'bg-green-400/10 text-green-400' :
                      app.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                      app.status === 'building' || app.status === 'deploying' ? 'bg-primary/10 text-primary' :
                      'bg-white/5 text-white/20'
                    }`}>
                      {app.status === 'building' || app.status === 'deploying' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : app.status === 'live' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Rocket className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {app.displayName}
                        {app.isIsolated && <span className="px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 text-[10px] uppercase">Isolated</span>}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">{app.appId}</span>
                        <div className="w-1 h-1 rounded-full bg-white/10" />
                        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                          <Globe className="w-2.5 h-2.5 text-white/20" />
                          <span className="text-[9px] font-mono text-white/40">{targetProject || app.project}</span>
                        </div>
                        {targetEmail && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                            <ShieldCheck className="w-2.5 h-2.5 text-white/20" />
                            <span className="text-[9px] font-medium text-white/30 truncate max-w-[120px]">{targetEmail}</span>
                          </div>
                        )}
                        <div className="w-1 h-1 rounded-full bg-white/10" />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          app.status === 'live' ? 'text-green-400' :
                          app.status === 'failed' ? 'text-red-400' :
                          app.status === 'building' || app.status === 'deploying' ? 'text-primary animate-pulse' :
                          'text-white/20'
                        }`}>{app.status}</span>
                        
                        {/* Health Status */}
                        <div className="w-1 h-1 rounded-full bg-white/10" />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          currentSuite?.apps?.[app.appId]?.health?.status === 'healthy' ? 'text-green-400' :
                          currentSuite?.apps?.[app.appId]?.health?.status === 'degraded' ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          Health: {currentSuite?.apps?.[app.appId]?.health?.status || 'Unknown'}
                        </span>
                        
                        {/* Last Deployed Badge */}
                        {deployHistory.find(h => h.appId === app.appId && h.status === 'live') && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="text-[10px] text-white/30 font-medium italic">
                               Last: {formatDistanceToNow(parseDate(deployHistory.find(h => h.appId === app.appId && h.status === 'live')?.startedAt), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2">
                    {!batchRunning && (app.status !== 'building' && app.status !== 'deploying') ? (
                      <>
                        <button
                          onClick={() => setModalConfig({ isOpen: true, type: 'deploy', app: app })}
                          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all border border-primary/20 group/btn"
                          title="Deploy this app"
                        >
                          <Rocket className="w-4 h-4 group-hover/btn:animate-bounce" />
                        </button>
                        <button
                          onClick={() => setModalConfig({ isOpen: true, type: 'rollback', app: app })}
                          className="p-2 rounded-lg bg-white/5 hover:bg-cyan-400/10 text-white/20 hover:text-cyan-400 transition-all"
                          title="Rollback"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </>
                    ) : (app.status === 'building' || app.status === 'deploying' || app.status === 'verifying') && (
                      <button 
                        onClick={() => cancelAppDeployment(app.appId)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Cancel Deployment"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}

                    {/* Log toggle */}
                    {(app.logs.length > 0 || app.status === 'building' || app.status === 'deploying') && (
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : app.appId)}
                        className={`p-2 rounded-lg transition-colors ${
                          isExpanded ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/30 hover:text-white/60'
                        }`}
                      >
                        <Terminal className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
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
                
                {/* Build Progress Bar */}

                {/* Progress Bar */}
                {(app.status === 'building' || app.status === 'deploying') && (
                  <div className="mt-1">
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          app.status === 'building'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-primary animate-pulse'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 px-4 pb-3">
                      <span className="text-[10px] text-white/30 font-medium">
                        Elapsed: {formatElapsed(app.elapsed)}
                      </span>
                      <span className="text-[10px] text-white/30 font-medium">
                        Est: {formatDuration(estimate.estimatedDuration)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Terminal Log Area */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/10 bg-black/40 overflow-hidden"
                    >
                      <div 
                        ref={el => { logRefs.current[app.appId] = el; }}
                        className="max-h-[300px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
                      >
                        {app.logs.length === 0 ? (
                          <div className="text-white/20 italic italic flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Waiting for build pipeline logs...
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {app.logs.map((log, i) => (
                              <div key={i} className="flex gap-3 group">
                                <span className="text-white/10 select-none w-6 text-right">{i + 1}</span>
                                <span className={`whitespace-pre-wrap break-all ${
                                  log.includes('──') ? 'text-primary font-bold' :
                                  log.includes('error') || log.includes('Failed') ? 'text-red-400' :
                                  log.includes('success') || log.includes('Done') ? 'text-green-400' :
                                  'text-white/60'
                                }`}>
                                  {log}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        {/* History / Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Recent History
            </h3>
            <div className="space-y-3">
              {deployHistory.slice(0, 5).map((record) => (
                <div key={record.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/90">{record.appId}</span>
                    <span className={`text-[10px] font-bold uppercase ${record.status === 'live' ? 'text-green-400' : 'text-red-400'}`}>
                      {record.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/30">
                    <span>{formatDistanceToNow(parseDate(record.startedAt), { addSuffix: true })}</span>
                    <span>{formatDuration(record.duration || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {deployResult && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`bg-[#050505] w-full max-w-lg flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border ${deployResult.status === 'live' ? 'border-green-500/30' : 'border-red-500/30'} rounded-3xl relative overflow-hidden animate-in zoom-in duration-300`}>
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${deployResult.status === 'live' ? 'from-green-500/50 via-green-500 to-green-500/50' : 'from-red-500/50 via-red-500 to-red-500/50'} z-20`} />
            
            <div className="p-8 pb-6 text-center space-y-4">
              <div className={`w-16 h-16 rounded-full ${deployResult.status === 'live' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'} flex items-center justify-center mx-auto border`}>
                {deployResult.status === 'live' ? (
                  <Check className="w-8 h-8 text-green-400" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">
                  {deployResult.status === 'live' ? 'Deployment Success' : 'Deployment Failed'}
                </h2>
                <p className={`text-[10px] ${deployResult.status === 'live' ? 'text-green-400/60' : 'text-red-400/60'} font-bold uppercase tracking-[0.2em]`}>
                  {deployResult.displayName}
                </p>
              </div>
            </div>

            <div className="px-8 pb-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Target Environment</p>
                  <p className="text-sm font-bold text-white truncate">{deployResult.targetProject}</p>
                  <p className="text-[8px] font-mono text-white/40">{deployResult.targetEmail}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Operational Stats</p>
                  <p className="text-sm font-bold text-white">{deployResult.status === 'live' ? 'LIVE' : 'FAILED'}</p>
                  <p className="text-[8px] font-mono text-white/40">Duration: {deployResult.duration}s</p>
                </div>
              </div>

              {deployResult.status === 'live' && deployResult.url && (
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Access URL</p>
                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 text-[7px] font-bold uppercase tracking-widest">Active</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-white/90 truncate hover:text-green-400 transition-colors block italic underline underline-offset-4">
                        {deployResult.url}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {deployResult.status === 'failed' && deployResult.error && (
                <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-400/40">Error Detail</p>
                  <p className="text-[10px] font-mono text-red-200/60 leading-relaxed whitespace-pre-wrap break-words max-h-[60px] overflow-y-auto">
                    {deployResult.error}
                  </p>
                </div>
              )}

              {/* Terminal Output in Modal */}
              {deployResult.logs && deployResult.logs.length > 0 && (
                <div className="p-4 bg-black/60 rounded-2xl border border-white/5 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Final Terminal Output</p>
                  <div className="max-h-[150px] overflow-y-auto font-mono text-[9px] text-white/50 space-y-1 scrollbar-thin scrollbar-thumb-white/10 p-2 bg-black/40 rounded-xl">
                    {deployResult.logs.slice(-20).map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-white/10 w-4 text-right select-none">{i + 1}</span>
                        <span className="whitespace-pre-wrap break-all">{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setDeployResult(null)}
                className={`w-full h-12 ${deployResult.status === 'live' ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20' : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'} text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98]`}
              >
                Close Status HUD
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
