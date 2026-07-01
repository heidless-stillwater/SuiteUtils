import { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Loader2, ArrowRight, LayoutGrid, List, ArrowUp, ArrowDown, ExternalLink, ShieldAlert, X, Target, Layout, Server, Square, Play, CheckSquare, CheckCircle2, ChevronRight, Terminal, Search, Filter, Settings, Activity, Cpu, Shield, Zap, Maximize2, Minimize2, MoreVertical, Trash2, Copy, Clock, Check, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { API_URL } from '../lib/api-config';
import { motion, AnimatePresence } from 'framer-motion';
import MemberDashboard from '../components/dashboard/MemberDashboard';
import ValidationConsole from '../components/dashboard/ValidationConsole';
import PersonaConsole from '../components/dashboard/PersonaConsole';
import SovereignNeuralChat from '../components/dashboard/member/SovereignNeuralChat';
import { renderInstructions } from '../components/dashboard/ValidationModal';

interface HealthResult {
  appId: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  lastChecked: string;
  latency?: number;
  pid?: number;
  port?: number;
  appVersion?: string;
  error?: string;
}

export function DashboardPage() {
  const { currentSuite, dbError } = useSuite();
  const { profile } = useAuth();
  const [healthResults, setHealthResults] = useState<HealthResult[]>([]);
  const [workspaceConfig, setWorkspaceConfig] = useState<any>(null);
  const [loadingAppId, setLoadingAppId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSortType, setActiveSortType] = useState<'name' | 'timestamp' | 'updated' | 'custom'>('custom');
  const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (workspaceConfig?.defaultSort) {
      setActiveSortType(workspaceConfig.defaultSort.type || 'custom');
      setActiveSortDirection(workspaceConfig.defaultSort.direction || 'asc');
    }
  }, [workspaceConfig]);

  // Dashboard View State
  const [dashboardMode, setDashboardMode] = useState<'SOVEREIGN' | 'REGISTRY' | 'VALIDATION'>('REGISTRY');
  const [isManualMode, setIsManualMode] = useState(true);

  // Log Viewer State
  const [selectedLogApp, setSelectedLogApp] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<'enable' | 'disable' | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [isPersonaActive, setIsPersonaActive] = useState(false);
  const [viewMode, setViewMode] = useState<'casual' | 'pro'>('pro');
  
  // Validation Drawer State
  const [selectedValidation, setSelectedValidation] = useState<any>(null);
  const [highlightedValidationId, setHighlightedValidationId] = useState<string | null>(null);
  const [isValidationOpen, setIsValidationOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [copiedValId, setCopiedValId] = useState<string | null>(null);
  const [copiedInfo, setCopiedInfo] = useState<{ text: string; type: 'path' | 'command' } | null>(null);
  const [instructionsViewMode, setInstructionsViewMode] = useState<'MARKDOWN' | 'RAW'>('MARKDOWN');

  const handleCopyValId = (v: any) => {
    const displayId = getDisplayId(v);
    navigator.clipboard.writeText(displayId);
    setCopiedValId(v.id);
    setTimeout(() => setCopiedValId(null), 1500);
  };

  const handleCopyNotification = (text: string, type: 'path' | 'command' | 'validation') => {
    if (type === 'validation') {
      fetch(`${API_URL}/api/validations`, { headers: { 'x-workspace-id': 'stillwater-suite' } })
        .then(res => res.json())
        .then(data => {
          const found = data.find((v: any) => 
            v.id === text || 
            v.id.endsWith(text) || 
            v.tag === text || 
            v.tag.includes(text) ||
            (v.instructions && v.instructions.includes(text))
          );
          if (found) {
            setSelectedValidation(found);
            setHighlightedValidationId(found.id);
            const url = new URL(window.location.href);
            url.searchParams.set('validation', text);
            window.history.pushState({}, '', url.toString());
          }
        });
    } else {
      setCopiedInfo({ text, type });
      setTimeout(() => setCopiedInfo(null), 2000);
    }
  };
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    validation: any;
    isLastInGroup: boolean;
  } | null>(null);
  const [orchestrationConfirmation, setOrchestrationConfirmation] = useState<{
    appId?: string;
    appIds?: string[];
    action: 'start' | 'stop' | 'restart';
    displayName: string;
    isBulk?: boolean;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDeleteClick = async (validation: any) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/validations`, {
        headers: { 'x-workspace-id': 'stillwater-suite' }
      });
      const data = await res.json();
      const groupCount = data.filter((v: any) => v.group === validation.group).length;
      setDeleteConfirmation({
        validation,
        isLastInGroup: groupCount === 1
      });
    } catch (err) {
      console.error('Failed to analyze validation group size:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const executeDelete = async (mode: 'soft' | 'hard') => {
    if (!deleteConfirmation) return;
    const { validation } = deleteConfirmation;
    try {
      const res = await fetch(`${API_URL}/api/validations/${validation.id}?mode=${mode}`, {
        method: 'DELETE',
        headers: { 'x-workspace-id': 'stillwater-suite' }
      });
      if (res.ok) {
        setSelectedValidation(null);
        setDeleteConfirmation(null);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to delete validation:', err);
    }
  };

  const formatElapsedTime = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getDisplayId = (v: any) => {
    if (!v) return '';
    const match = v.instructions?.match(/VAL-[A-Z0-9-]+/);
    return match ? match[0] : v.id?.split('_').pop()?.substring(0, 8);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    const allIds = Object.keys(currentSuite?.apps || {});
    setSelectedIds(prev => prev.length === allIds.length ? [] : allIds);
  };

  // Parse URL parameters for direct validation deep-linking
  useEffect(() => {
    if (!currentSuite?.id) return;
    fetch(`${API_URL}/api/workspaces/current`, {
      headers: { 'x-workspace-id': currentSuite.id }
    })
      .then(res => res.json())
      .then(data => {
        setWorkspaceConfig(data);
      })
      .catch(console.error);
  }, [currentSuite?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const valId = params.get('validation');
    if (valId) {
      setIsValidationOpen(true);
      
      // Fetch the full validation data to populate the detail view
      fetch(`${API_URL}/api/validations`, { headers: { 'x-workspace-id': 'stillwater-suite' } })
        .then(res => res.json())
        .then(data => {
          const found = data.find((v: any) => 
            v.id === valId || 
            v.id.endsWith(valId) || 
            v.tag === valId || 
            v.tag.includes(valId) ||
            (v.instructions && v.instructions.includes(valId))
          );
          if (found) {
            setSelectedValidation(found);
            setHighlightedValidationId(found.id);
          } else {
            console.warn(`Validation ${valId} not found in backlog.`);
            const syntheticVal = {
              id: valId,
              title: `Unregistered Audit Point: ${valId}`,
              feature: 'External Context',
              tag: 'UNREGISTERED',
              status: 'PENDING',
              instructions: `This validation tag (${valId}) was referenced via deep-link but has not been synchronized to the Sovereign backend. It was likely generated in an external context (e.g., IDE chat) rather than the monitored dashboard terminal.`,
              expectedResult: 'Awaiting manual synchronization or backend ingestion.',
              lastUpdated: new Date().toISOString(),
              sequence: 0,
              group: 'External Tracking'
            };
            setSelectedValidation(syntheticVal);
            setHighlightedValidationId(valId);
          }
        })
        .catch(console.error);
      
      // Clean up the URL without reloading the page
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const handleSelectValidationEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      const text = customEvent.detail?.id;
      if (text) {
        fetch(`${API_URL}/api/validations`, { headers: { 'x-workspace-id': 'stillwater-suite' } })
          .then(res => res.json())
          .then(data => {
            const found = data.find((v: any) => 
              v.id === text || 
              v.id.endsWith(text) || 
              v.tag === text || 
              v.tag.includes(text) ||
              (v.instructions && v.instructions.includes(text))
            );
            if (found) {
              setSelectedValidation(found);
              setHighlightedValidationId(found.id);
              setIsValidationOpen(true);
              setDashboardMode('REGISTRY');
              
              const url = new URL(window.location.href);
              url.searchParams.set('validation', text);
              window.history.pushState({}, '', url.toString());
            } else {
              const syntheticVal = {
                id: text,
                title: `Unregistered Audit Point: ${text}`,
                feature: 'External Context',
                tag: 'UNREGISTERED',
                status: 'PENDING',
                instructions: `This validation tag (${text}) was referenced but has not been synchronized to the Sovereign backend.`,
                expectedResult: 'Awaiting manual synchronization or backend ingestion.',
                lastUpdated: new Date().toISOString(),
                sequence: 0,
                group: 'External Tracking'
              };
              setSelectedValidation(syntheticVal);
              setHighlightedValidationId(text);
              setIsValidationOpen(true);
              setDashboardMode('REGISTRY');
            }
          })
          .catch(console.error);
      }
    };

    window.addEventListener('select-validation', handleSelectValidationEvent);
    return () => {
      window.removeEventListener('select-validation', handleSelectValidationEvent);
    };
  }, []);

  useEffect(() => {
    const wsId = currentSuite?.id || 'stillwater-suite';
    const startTime = Date.now();
    let interval: any;

    const fetchHealth = async () => {
      try {
        if (!isInitialLoading) setIsRefreshing(true);
        const res = await fetch(`${API_URL}/api/health`, {
          headers: { 'x-workspace-id': wsId }
        });
        const data: HealthResult[] = await res.json();
        
        const personaHealth = data.find(h => h.appId.toLowerCase() === 'persona');
        const isActive = personaHealth?.status === 'UP';
        
        setIsPersonaActive(isActive);
        setHealthResults(data);
        
        if (!isManualMode) {
          if (isActive && dashboardMode === 'REGISTRY') {
            setDashboardMode('SOVEREIGN');
          } else if (!isActive && dashboardMode === 'SOVEREIGN') {
            setDashboardMode('REGISTRY');
          }
        }
        
        if (isInitialLoading) {
          const totalApps = Object.keys(currentSuite?.apps || {}).length || 8;
          const live = data.filter(h => h.status === 'UP' || h.appId === 'suiteutils').length;
          const elapsed = Date.now() - startTime;
          
          // Complete if all are up (min 3s) or if timeout (30s)
          if ((live >= totalApps && elapsed > 3000) || elapsed > 30000) {
            setIsInitialLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch health:', err);
        if (isInitialLoading) setIsInitialLoading(false);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchHealth();
    // Faster polling during initial load (1.5s), slower otherwise (10s)
    interval = setInterval(fetchHealth, isInitialLoading ? 1500 : 10000);
    return () => clearInterval(interval);
  }, [currentSuite?.id, isInitialLoading, isManualMode]);

  const waitForStatus = async (appId: string, targetStatus: 'UP' | 'DOWN', maxAttempts = 30) => {
    const wsId = currentSuite?.id || 'stillwater-suite';
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`${API_URL}/api/health`, {
          headers: { 'x-workspace-id': wsId }
        });
        const health: HealthResult[] = await res.json();
        const appHealth = health.find(h => h.appId.trim().toLowerCase() === appId.trim().toLowerCase());
        
        if (appHealth?.status === targetStatus) {
          setHealthResults(health);
          return true;
        }
      } catch (err) {
        console.error(`Polling health failed for ${appId}:`, err);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  };

  const handleAction = async (appId: string, action: 'start' | 'stop' | 'restart', force = false) => {
    if (!force) {
      const displayName = currentSuite?.apps?.[appId]?.displayName || infrastructure.find((entry: any) => entry[0] === appId)?.[1]?.displayName || appId;
      setOrchestrationConfirmation({
        appId,
        action,
        displayName,
        isBulk: false
      });
      return;
    }

    const LINKED_MODULES: Record<string, string> = {
      'suiteutils': 'suiteutils-api',
      'suiteutils-api': 'suiteutils',
      'persona': 'persona-bridge',
      'persona-bridge': 'persona'
    };
    const linkedId = LINKED_MODULES[appId];

    setLoadingAppId(appId);
    setCompletedIds(prev => prev.filter(id => id !== appId && id !== linkedId));
    
    try {
      await new Promise(r => setTimeout(r, 600));
      const res = await fetch(`${API_URL}/api/suite/${action}/${appId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to ${action} ${appId}`);
      
      const startTime = Date.now();
      const targetStatus = action === 'stop' ? 'DOWN' : 'UP';
      await waitForStatus(appId, targetStatus);
      
      // Force a substantial visual buffer for cinematic telemetry
      const elapsed = Date.now() - startTime;
      const minDuration = 4000; 
      if (elapsed < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - elapsed));
      }

      setCompletedIds(prev => {
        const next = [...prev, appId];
        if (linkedId) next.push(linkedId);
        return next;
      });
      
      // Let the "CONFIRMED" checkmark linger
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAppId(null);
      // Wait a bit before clearing completedIds so the UI reflects success
      setTimeout(() => setCompletedIds(prev => prev.filter(id => id !== appId && id !== linkedId)), 3000);
    }
  };

  const openLogs = async (appId: string) => {
    setSelectedLogApp(appId);
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/api/suite/logs/${appId}`);
      const data = await res.json();
      setLogs(data.logs);
    } catch (err) {
      setLogs('Failed to fetch logs.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleBulkToggle = async (enabled: boolean, force = false) => {
    const action = enabled ? 'start' : 'stop';
    const allGridIds = [...apps.map((entry: any) => entry[0]), ...infrastructure.map((entry: any) => entry[0])];
    const targetIds = selectedIds.length > 0 ? selectedIds : allGridIds;
    
    if (!force) {
      const displayNames = targetIds.map(id => currentSuite?.apps?.[id]?.displayName || infrastructure.find((entry: any) => entry[0] === id)?.[1]?.displayName || id);
      const displayName = targetIds.length === apps.length 
        ? 'All Modules'
        : displayNames.join(', ');
      setOrchestrationConfirmation({
        appIds: targetIds,
        action,
        displayName,
        isBulk: true
      });
      return;
    }

    setBulkActionType(enabled ? 'enable' : 'disable');
    
    try {
      for (const appId of targetIds) {
        setLoadingAppId(appId);
        setCompletedIds(prev => prev.filter(id => id !== appId));
        
        try {
          await new Promise(r => setTimeout(r, 500));
          const res = await fetch(`${API_URL}/api/suite/${action}/${appId}`, { method: 'POST' });
          if (!res.ok) throw new Error(`Failed to toggle ${appId}`);
          
          const targetStatus = enabled ? 'UP' : 'DOWN';
          const opStartTime = Date.now();
          await waitForStatus(appId, targetStatus);
          
          // Cinematic pause for bulk operations
          const opElapsed = Date.now() - opStartTime;
          if (opElapsed < 3000) {
            await new Promise(r => setTimeout(r, 3000 - opElapsed));
          }

          setCompletedIds(prev => [...prev, appId]);
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.error(`Error toggling ${appId}:`, err);
        }
      }
      
      // Global Refresh
      const wsId = currentSuite?.id || 'stillwater-suite';
      const healthRes = await fetch(`${API_URL}/api/health`, {
        headers: { 'x-workspace-id': wsId }
      });
      setHealthResults(await healthRes.json());
    } finally {
      setLoadingAppId(null);
      setBulkActionType(null);
      setSelectedIds([]);
      // Persist completed states for 5 seconds after bulk finish
      setTimeout(() => setCompletedIds([]), 5000);
    }
  };



  if (dbError) {
    return (
      <div className="page-enter space-y-4">
        <h1 className="text-2xl font-bold text-red-400">Firestore Error</h1>
        <div className="glass-card-static p-6 border border-red-500/20">
          <p className="text-sm text-white/80 mb-2">The suites collection could not be loaded:</p>
          <pre className="text-xs text-red-300 bg-black/30 p-4 rounded-xl overflow-auto">{dbError}</pre>
        </div>
      </div>
    );
  }

  const workspaceAppIds = workspaceConfig?.apps?.map((a: any) => a.id.toLowerCase()) || [];
  
  const apps = Object.entries(currentSuite?.apps || {})
    .filter(([id]) => {
      if (!workspaceConfig) return true;
      return workspaceAppIds.includes(id.toLowerCase());
    })
    .map(([id, appConfig]) => {
      const wsApp = workspaceConfig?.apps?.find((a: any) => a.id.toLowerCase() === id.toLowerCase());
      return [
        id,
        {
          ...appConfig,
          lastUpdatedAt: wsApp?.lastUpdatedAt || null
        }
      ] as [string, any];
    });

  const infrastructure = (workspaceConfig?.infrastructure || []).map((infra: any) => {
    return [
      infra.id,
      {
        displayName: infra.name,
        name: infra.name,
        path: infra.projectPath,
        hostingTarget: infra.hostingTarget,
        dbId: infra.dbId,
        lastUpdatedAt: infra.lastUpdatedAt || null,
        environments: {
          production: {
            status: 'not-configured',
            deployMethod: 'firebase',
            hostingTarget: infra.hostingTarget,
            lastDeployAt: null
          }
        }
      }
    ];
  });

  const handleFreezeSort = async (
    type: 'name' | 'timestamp' | 'updated' | 'custom',
    direction: 'asc' | 'desc',
    appOrder: string[],
    infraOrder: string[]
  ) => {
    try {
      const wsId = currentSuite?.id || 'stillwater-suite';
      const res = await fetch(`${API_URL}/api/workspaces/${wsId}/freeze-sort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': wsId
        },
        body: JSON.stringify({ type, direction, appOrder, infraOrder })
      });
      const data = await res.json();
      if (data.success && data.workspace) {
        setWorkspaceConfig(data.workspace);
      }
    } catch (err) {
      console.error('Failed to freeze sort order:', err);
    }
  };
  const liveApps = healthResults.filter(h => h.status === 'UP' || h.appId.toLowerCase() === 'suiteutils');
  const failedApps = healthResults.filter(h => h.status === 'DOWN' && h.appId.toLowerCase() !== 'suiteutils');

  return (
    <div className="relative min-h-screen">
      <AnimatePresence>
        {(isInitialLoading || isRefreshing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] h-[3px] bg-primary/5 overflow-hidden"
          >
            <motion.div 
              initial={{ width: '0%', left: '-40%' }}
              animate={{ left: ['-40%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute h-full w-2/5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Pinned Validation Sidebar */}
        <AnimatePresence>
          {isValidationOpen && (dashboardMode === 'REGISTRY' || (dashboardMode === 'VALIDATION' && selectedValidation)) && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="fixed top-16 bottom-0 z-40 border-r border-white/5 bg-black/60 backdrop-blur-3xl overflow-hidden flex flex-col transition-all duration-300"
              style={{ left: 'var(--sidebar-width)' }}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-3">
                  {selectedValidation ? (
                    <button 
                      onClick={() => setSelectedValidation(null)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all flex items-center gap-2 group"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
                    </button>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Validation</h3>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setIsValidationOpen(false);
                      setSelectedValidation(null);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {selectedValidation ? (
                    <motion.div 
                      key="detail"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-6 space-y-6"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span 
                                  className="text-[9px] font-black font-mono text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 tracking-tighter"
                                  title={`Validation ID: ${getDisplayId(selectedValidation)}`}
                                >
                                  {getDisplayId(selectedValidation)}
                                </span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleCopyValId(selectedValidation); }}
                                  className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                                  title={copiedValId === selectedValidation.id ? "Copied!" : "Copy Validation ID"}
                                >
                                  {copiedValId === selectedValidation.id ? (
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button 
                                  disabled={isDeleting}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(selectedValidation); }}
                                  className="p-1 hover:bg-red-500/20 rounded text-white/40 hover:text-red-500 transition-colors disabled:opacity-50"
                                  title="Delete Validation"
                                >
                                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 bg-white/5 opacity-60">
                                {selectedValidation.tag}
                              </span>
                              <span 
                                className="text-[9px] font-black font-mono text-white/40 tracking-widest uppercase"
                                title={`Execution Sequence: ${selectedValidation.sequence}`}
                              >
                                SEQ-{selectedValidation.sequence}
                              </span>
                            </div>
                            
                            <div className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shrink-0",
                              selectedValidation.status === 'PASS' ? 'text-green-500 border-green-500/30 bg-green-500/10' :
                              selectedValidation.status === 'FAIL' ? 'text-red-500 border-red-500/30 bg-red-500/10' :
                              'text-white/60 border-white/20 bg-white/5'
                            )}>
                              {selectedValidation.status}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-white/40" />
                            <span 
                              className="text-[9px] font-mono text-white/40 uppercase"
                              title={`Last Updated: ${new Date(selectedValidation.lastUpdated).toLocaleString()} (${formatElapsedTime(selectedValidation.lastUpdated)})`}
                            >
                              {formatElapsedTime(selectedValidation.lastUpdated)}
                            </span>
                          </div>
                        </div>
                        <h2 className="text-lg font-bold text-white leading-tight">
                          {selectedValidation.title}
                        </h2>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 text-primary/60">
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Instructions</h3>
                          {/* Markdown vs Raw Toggle */}
                          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                            <button
                              onClick={() => setInstructionsViewMode('MARKDOWN')}
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                instructionsViewMode === 'MARKDOWN'
                                  ? "bg-primary text-black shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]"
                                  : "text-white/40 hover:text-white"
                              )}
                            >
                              Rendered
                            </button>
                            <button
                              onClick={() => setInstructionsViewMode('RAW')}
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                instructionsViewMode === 'RAW'
                                  ? "bg-white/10 text-white"
                                  : "text-white/40 hover:text-white"
                              )}
                            >
                              Raw
                            </button>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 border-l-4 border-l-primary leading-relaxed relative group overflow-hidden">
                          {renderInstructions(selectedValidation.instructions, instructionsViewMode, handleCopyNotification)}
                          
                          {/* Floating Notification for copied path or command */}
                          <AnimatePresence>
                            {copiedInfo && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 backdrop-blur-md shadow-lg"
                              >
                                <Check className="w-2.5 h-2.5 text-green-400" />
                                {copiedInfo.type === 'path' ? 'Copied Path!' : 'Copied Command!'}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60">Expected Result</h3>
                        <div className="p-4 rounded-xl bg-indigo-400/5 border border-indigo-400/10 border-l-4 border-l-indigo-400 text-xs text-white/60 italic leading-relaxed">
                          {selectedValidation.expectedResult}
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={async () => {
                              await fetch(`${API_URL}/api/validations/${selectedValidation.id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'stillwater-suite' },
                                body: JSON.stringify({ status: 'PASS' })
                              });
                              // Quick visual feedback then return to list
                              setSelectedValidation({ ...selectedValidation, status: 'PASS' });
                              setTimeout(() => setSelectedValidation(null), 800);
                            }}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white border border-green-500/20 transition-all font-black uppercase tracking-widest text-[10px]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verify Pass
                          </button>
                          <button 
                            onClick={async () => {
                              await fetch(`${API_URL}/api/validations/${selectedValidation.id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'stillwater-suite' },
                                body: JSON.stringify({ status: 'FAIL' })
                              });
                              setSelectedValidation({ ...selectedValidation, status: 'FAIL' });
                              setTimeout(() => setSelectedValidation(null), 800);
                            }}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all font-black uppercase tracking-widest text-[10px]"
                          >
                            <X className="w-3.5 h-3.5" />
                            Mark Fail
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-2"
                    >
                      <ValidationConsole 
                        selectedId={selectedValidation?.id || highlightedValidationId || undefined}
                        onSelect={(v) => {
                          if (v) setHighlightedValidationId(v.id);
                          setSelectedValidation(v);
                        }}
                        compact={true}
                        refreshTrigger={refreshTrigger}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
                <p className="text-[9px] text-white/20 uppercase tracking-widest">
                  Sovereign Audit Context
                </p>
                <p className="text-[9px] font-mono text-white/10 uppercase">
                  Port 5180
                </p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Dashboard Content */}
        <div className={cn(
          "flex-1 min-w-0 p-8 space-y-8 transition-all duration-300",
          (isValidationOpen && dashboardMode === 'REGISTRY') ? "pl-[412px]" : ""
        )}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <Link 
                to="/persona"
                className="group flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/20 hover:border-primary/40 transition-all backdrop-blur-xl"
              >
                <Target className="w-4 h-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-1">Neural Link</span>
                  <span className="text-[10px] font-bold text-white/90 uppercase tracking-tight">Persona Core</span>
                </div>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white/90 mb-1">Hive Operations</h1>
                <p className="text-white/40 text-sm">{currentSuite?.name || 'Stillwater'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 shadow-xl">
                <PerspectiveButton 
                  active={dashboardMode === 'SOVEREIGN'} 
                  onClick={() => { setDashboardMode('SOVEREIGN'); setIsManualMode(true); }}
                  icon={<Layout className="w-3.5 h-3.5" />}
                  label="Sovereign"
                  statusDot={isPersonaActive}
                />
                <PerspectiveButton 
                  active={dashboardMode === 'REGISTRY'} 
                  onClick={() => { setDashboardMode('REGISTRY'); setIsManualMode(true); }}
                  icon={<List className="w-3.5 h-3.5" />}
                  label="Registry"
                  tally={`${liveApps.length}/${apps.length + infrastructure.length}`}
                />
              </div>

              <button
                onClick={() => setIsValidationOpen(!isValidationOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300 ${
                  isValidationOpen 
                    ? 'bg-primary text-black border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]' 
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-primary hover:border-primary/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">
                  Audit
                </span>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {dashboardMode === 'VALIDATION' ? (
              <motion.div key="val" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                <ValidationConsole 
                  selectedId={selectedValidation?.id} 
                  onSelect={(v) => {
                    setSelectedValidation(v);
                    if (v) {
                      setHighlightedValidationId(v.id);
                      setIsValidationOpen(true);
                    } else {
                      setIsValidationOpen(false);
                    }
                  }} 
                  refreshTrigger={refreshTrigger} 
                />
              </motion.div>
            ) : dashboardMode === 'SOVEREIGN' ? (
              <motion.div key="sov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                {isPersonaActive ? <PersonaConsole /> : <div className="p-12 glass-card text-center text-white/40">Persona Core Offline</div>}
              </motion.div>
            ) : (
              <motion.div key="reg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <MemberDashboard 
                  profile={profile}
                  apps={apps}
                  infrastructure={infrastructure}
                  healthResults={healthResults}
                  onOpenLogs={openLogs}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  handleAction={handleAction}
                  handleBulkToggle={handleBulkToggle}
                  loadingAppId={loadingAppId}
                  completedIds={completedIds}
                  bulkActionType={bulkActionType}
                  viewMode={viewMode}
                  activeSortType={activeSortType}
                  setActiveSortType={setActiveSortType}
                  activeSortDirection={activeSortDirection}
                  setActiveSortDirection={setActiveSortDirection}
                  onFreezeSort={handleFreezeSort}
                  defaultSort={workspaceConfig?.defaultSort}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedLogApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full max-w-4xl h-[80vh] flex flex-col border-primary/20">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">{selectedLogApp} Telemetry</h2>
                <button onClick={() => setSelectedLogApp(null)} className="p-2 text-white/40 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-white/60 whitespace-pre-wrap">
                {loadingLogs ? <Loader2 className="animate-spin mx-auto mt-12" /> : logs || 'No stream data.'}
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirmation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-md p-8 border-red-500/20 text-center flex flex-col items-center gap-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <Trash2 className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Confirm Test Deletion</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  You are about to remove <span className="text-primary font-bold font-mono">{deleteConfirmation.validation.id}</span> ("{deleteConfirmation.validation.title}").
                </p>
                {deleteConfirmation.isLastInGroup && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 leading-relaxed">
                    ⚠️ WARNING: This is the last test in this group. Executing a Hard Delete will permanently destroy the parent group header: <span className="underline">{deleteConfirmation.validation.group}</span>.
                  </div>
                )}
              </div>

              <div className="w-full space-y-3">
                <button
                  onClick={() => executeDelete('soft')}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Soft Delete (Recommended)
                  <span className="block text-[8px] text-white/40 font-normal lowercase mt-0.5">Hides it from UI, keeps raw markdown audit trace</span>
                </button>

                <button
                  onClick={() => executeDelete('hard')}
                  className="w-full py-3.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Hard Delete (Destructive)
                  <span className="block text-[8px] text-red-400/60 font-normal lowercase mt-0.5">Surgically erases it from the physical markdown file</span>
                </button>
                
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="w-full py-2.5 text-white/40 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {orchestrationConfirmation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "glass-card w-full max-w-md p-8 text-center flex flex-col items-center gap-6 border",
                orchestrationConfirmation.action === 'start' ? 'border-primary/20' :
                orchestrationConfirmation.action === 'stop' ? 'border-red-500/20' :
                'border-indigo-500/20'
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl border flex items-center justify-center shadow-lg",
                orchestrationConfirmation.action === 'start' ? 'bg-primary/10 border-primary/20 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]' :
                orchestrationConfirmation.action === 'stop' ? 'bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' :
                'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
              )}>
                {orchestrationConfirmation.action === 'start' ? <Play className="w-8 h-8 fill-current" /> :
                 orchestrationConfirmation.action === 'stop' ? <Square className="w-8 h-8 fill-current" /> :
                 <RotateCcw className="w-8 h-8 animate-spin-slow" />}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  {orchestrationConfirmation.isBulk 
                    ? `Confirm Bulk ${orchestrationConfirmation.action === 'start' ? 'Ignition' : 'Extinction'}`
                    : `Confirm Module ${orchestrationConfirmation.action === 'start' ? 'Ignition' : orchestrationConfirmation.action === 'stop' ? 'Extinction' : 'Reboot'}`}
                </h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  Are you sure you want to <span className={cn(
                    "font-bold uppercase",
                    orchestrationConfirmation.action === 'start' ? 'text-primary' :
                    orchestrationConfirmation.action === 'stop' ? 'text-red-400' :
                    'text-indigo-400'
                  )}>{orchestrationConfirmation.action === 'start' ? 'ignite' : orchestrationConfirmation.action === 'stop' ? 'extinguish' : 'reboot'}</span>{' '}
                  <span className="text-white font-bold">{orchestrationConfirmation.displayName}</span>?
                </p>
                {orchestrationConfirmation.isBulk && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-mono text-white/40 mt-2 leading-relaxed text-left max-h-24 overflow-y-auto custom-scrollbar w-full">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-primary mb-1">Targeted Modules:</span>
                    {orchestrationConfirmation.appIds?.map(id => (
                      <div key={id} className="flex items-center gap-1.5 py-0.5">
                        <div className="w-1 h-1 rounded-full bg-white/30" />
                        <span>{currentSuite?.apps?.[id]?.displayName || infrastructure.find((entry: any) => entry[0] === id)?.[1]?.displayName || id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full space-y-2">
                <button
                  onClick={() => {
                    const { appId, action, isBulk } = orchestrationConfirmation;
                    setOrchestrationConfirmation(null);
                    if (isBulk) {
                      handleBulkToggle(action === 'start', true);
                    } else if (appId) {
                      handleAction(appId, action, true);
                    }
                  }}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                    orchestrationConfirmation.action === 'start' ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]' :
                    orchestrationConfirmation.action === 'stop' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]' :
                    'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                  )}
                >
                  Confirm {orchestrationConfirmation.action === 'start' ? 'Ignition' : orchestrationConfirmation.action === 'stop' ? 'Extinction' : 'Reboot'}
                </button>
                
                <button
                  onClick={() => setOrchestrationConfirmation(null)}
                  className="w-full py-2.5 text-white/40 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all hover:scale-[1.02] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {dashboardMode !== 'VALIDATION' && <SovereignNeuralChat />}
    </div>
  );
}

function PerspectiveButton({ active, onClick, icon, label, statusDot, tally }: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  statusDot?: boolean;
  tally?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
        active 
          ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)] border border-primary/20' 
          : 'text-white/40 hover:text-white/70 hover:bg-white/5'
      }`}
    >
      <div className="relative">
        {icon}
        {statusDot !== undefined && (
          <div className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full border border-black ${statusDot ? 'bg-primary animate-pulse' : 'bg-white/20'}`} />
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{label}</span>
      {tally && (
        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${active ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'}`}>
          {tally}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { live: 'badge-success', deploying: 'badge-warning', failed: 'badge-danger' };
  return (
    <span className={`badge uppercase tracking-[0.15em] font-black text-[9px] ${styles[status] || 'badge-info'}`}>
      <span className={`status-dot ${status === 'live' ? 'status-dot-live' : 'status-dot-queued'}`} />
      {status}
    </span>
  );
}
