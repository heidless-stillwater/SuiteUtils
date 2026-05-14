import { useState, useEffect } from 'react';
import {
  Activity,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  ArrowRight,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Terminal,
  X,
  Loader2,
  CheckSquare,
  LayoutGrid,
  Columns
} from 'lucide-react';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { API_URL } from '../lib/api-config';
import { motion, AnimatePresence } from 'framer-motion';


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
  const [loadingAppId, setLoadingAppId] = useState<string | null>(null);
  
  // Log Viewer State
  const [selectedLogApp, setSelectedLogApp] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<'enable' | 'disable' | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [gridCols, setGridCols] = useState<3 | 4>(4);

  useEffect(() => {
    const wsId = currentSuite?.id || 'stillwater-suite';

    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`, {
          headers: { 'x-workspace-id': wsId }
        });
        const data = await res.json();
        setHealthResults(data);
      } catch (err) {
        console.error('Failed to fetch health:', err);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // 10s for more responsive non-tmux feel
    return () => clearInterval(interval);
  }, [currentSuite?.id]);

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
          // Success! Status matches.
          setHealthResults(health); // Update UI health state
          return true;
        }
      } catch (err) {
        console.error(`Polling health failed for ${appId}:`, err);
      }
      await new Promise(r => setTimeout(r, 1000)); // Poll every 1s
    }
    return false; // Timeout
  };

  const handleAction = async (appId: string, action: 'start' | 'stop' | 'restart') => {
    setLoadingAppId(appId);
    // Trigger telemetry for individual action
    setBulkActionType(action === 'stop' ? 'disable' : 'enable');
    const wasAlreadySelected = selectedIds.includes(appId);
    if (!wasAlreadySelected) setSelectedIds(prev => [...prev, appId]);
    
    try {
      // Stage 1: Initialization
      await new Promise(r => setTimeout(r, 500));
      
      const res = await fetch(`${API_URL}/api/suite/${action}/${appId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to ${action} ${appId}`);
      
      // Stage 2: Active Verification (Polling)
      const targetStatus = action === 'stop' ? 'DOWN' : 'UP';
      await waitForStatus(appId, targetStatus);
      
      setCompletedIds(prev => [...prev, appId]);
      
      // Brief victory pause
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAppId(null);
      setBulkActionType(null);
      setCompletedIds([]);
      // Clear selection only if we added it temporarily
      if (!wasAlreadySelected) setSelectedIds(prev => prev.filter(id => id !== appId));
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

  const handleBulkToggle = async (enabled: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkActionType(enabled ? 'enable' : 'disable');
    setCompletedIds([]);
    
    try {
      // We iterate sequentially to show individual progress on each card
      for (const appId of selectedIds) {
        setLoadingAppId(appId);
        try {
          const action = enabled ? 'start' : 'stop';
          
          // Stage 1: Initialization (Brief pause)
          await new Promise(r => setTimeout(r, 500));
          
          // Stage 2: Execution
          const res = await fetch(`${API_URL}/api/suite/${action}/${appId}`, {
            method: 'POST'
          });
          if (!res.ok) throw new Error(`Failed to toggle ${appId}`);
          
          // Stage 3: Active Verification (Polling)
          const targetStatus = enabled ? 'UP' : 'DOWN';
          await waitForStatus(appId, targetStatus);
          
          setCompletedIds(prev => [...prev, appId]);
          
          // Finalize state
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error(`Error toggling ${appId}:`, err);
        } finally {
          setLoadingAppId(null);
        }
      }

      // Victory pause - let the user see the completed state for a moment
      await new Promise(r => setTimeout(r, 1000));

      // Final health refresh after entire sequence completes
      const wsId = currentSuite?.id || 'stillwater-suite';
      try {
        const healthRes = await fetch(`${API_URL}/api/health`, {
          headers: { 'x-workspace-id': wsId }
        });
        setHealthResults(await healthRes.json());
      } catch (err) {
        console.error('Final health refresh failed:', err);
      }
    } finally {
      // Guaranteed cleanup
      setSelectedIds([]); 
      setBulkActionType(null);
      setCompletedIds([]);
    }
  };

  // Show Firestore errors prominently for debugging
  if (dbError) {
    return (
      <div className="page-enter space-y-4">
        <h1 className="text-2xl font-bold text-red-400">Firestore Error</h1>
        <div className="glass-card-static p-6 border border-red-500/20">
          <p className="text-sm text-white/80 mb-2">The suites collection could not be loaded:</p>
          <pre className="text-xs text-red-300 bg-black/30 p-4 rounded-xl overflow-auto">{dbError}</pre>
          <p className="text-xs text-white/40 mt-4">
            Check that the Firestore database "suiteutils-db-0" exists in project heidless-apps-2
            and that security rules allow authenticated reads.
          </p>
        </div>
      </div>
    );
  }

  const liveApps = healthResults.filter(h => h.status === 'UP');
  const failedApps = healthResults.filter(h => h.status === 'DOWN');

  // Stable Sort for Registry
  const apps = Object.entries(currentSuite?.apps || {}).sort((a, b) => 
    a[1].displayName.localeCompare(b[1].displayName)
  );

  return (
    <div className="page-enter space-y-8">
      {/* Welcome Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white/90 mb-1">
            Welcome back, {profile?.displayName?.split(' ')[0] || 'Commander'}
          </h1>
          <p className="text-white/40 text-sm">
            {currentSuite?.name || 'Stillwater'} Hive Operations Overview
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
           <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
           <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Live Feed</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="Total Apps"
          value={apps.length}
          accent="primary"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Live"
          value={liveApps.length}
          accent="success"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Down"
          value={failedApps.length}
          accent={failedApps.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          icon={<Terminal className="w-5 h-5" />}
          label="HIVE MODE"
          value="NON-TMUX"
          accent="info"
          isText
        />
      </div>



      {/* App Registry Grid */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-white/80">App Registry</h2>
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-wider">HIVE ORCHESTRATION LAYER</p>
            </div>
            <div className="h-8 w-px bg-white/10 mx-2" />
            <button
              onClick={() => {
                if (selectedIds.length === apps.length) setSelectedIds([]);
                else setSelectedIds(apps.map(([id]) => id));
              }}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/20 transition-all"
            >
              <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                selectedIds.length === apps.length ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-primary/50'
              }`}>
                {selectedIds.length === apps.length && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <span className="text-[10px] font-bold text-white/60 group-hover:text-primary transition-colors">
                {selectedIds.length === apps.length ? 'DESELECT ALL' : 'SELECT ALL'}
              </span>
            </button>
            <div className="h-8 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setGridCols(3)}
                className={`p-1.5 rounded-md transition-all ${gridCols === 3 ? 'bg-primary/20 text-primary' : 'text-white/20 hover:text-white/40'}`}
                title="3 Columns"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setGridCols(4)}
                className={`p-1.5 rounded-md transition-all ${gridCols === 4 ? 'bg-primary/20 text-primary' : 'text-white/20 hover:text-white/40'}`}
                title="4 Columns"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
              <span className="text-[10px] font-bold text-primary mr-2 bg-primary/10 px-2 py-1 rounded">
                {selectedIds.length} SELECTED
              </span>
              <button
                onClick={() => handleBulkToggle(true)}
                disabled={bulkActionType !== null}
                className="btn-primary !py-2 !px-4 text-[10px] bg-green-500/20 hover:bg-green-500/40 text-green-400 border-green-500/20 min-w-[140px]"
              >
                {bulkActionType === 'enable' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {loadingAppId ? `${apps.find(([id]) => id === loadingAppId)?.[1].displayName.toUpperCase() || '...'}` : 'ENABLING...'}
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    ENABLE SELECTED
                  </>
                )}
              </button>
              <button
                onClick={() => handleBulkToggle(false)}
                disabled={bulkActionType !== null}
                className="btn-primary !py-2 !px-4 text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-400 border-red-500/20 min-w-[140px]"
              >
                {bulkActionType === 'disable' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {loadingAppId ? `${apps.find(([id]) => id === loadingAppId)?.[1].displayName.toUpperCase() || '...'}` : 'DISABLING...'}
                  </>
                ) : (
                  <>
                    <Square className="w-3 h-3" />
                    DISABLE SELECTED
                  </>
                )}
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className="p-2 text-white/40 hover:text-white transition-colors"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/deploy"
              className="btn-primary text-xs !px-4 !py-2"
            >
              <Rocket className="w-3.5 h-3.5" />
              Global Deploy
            </Link>
          )}
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
          {apps.map(([id, app]) => {
            const prodEnv = app.environments.production;
            const status = prodEnv?.status || 'not-configured';
            const health = healthResults.find(h => 
              h.appId.trim().toLowerCase() === id.trim().toLowerCase()
            );
            const isWorking = loadingAppId === id;
            const isSelected = selectedIds.includes(id);
            const isCompleted = completedIds.includes(id);
            const isPending = bulkActionType !== null && isSelected && !isWorking && !isCompleted;

            return (
              <div
                key={id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  setSelectedIds(prev => 
                    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                  );
                }}
                className={`glass-card p-5 group relative overflow-hidden cursor-pointer transition-all duration-300 ${
                  isSelected ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_25px_rgba(var(--primary-rgb),0.15)]' : 'hover:border-white/10'
                }`}
              >
                {/* Orchestration Telemetry Overlay (Progress Bar & Status) */}
                {bulkActionType !== null && isSelected && (
                  <>
                    {/* Granular Progress Bar */}
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5 overflow-hidden z-[60]">
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ 
                          width: isCompleted ? '100%' : isWorking ? '75%' : '8%',
                          backgroundColor: isCompleted ? '#4ade80' : '#3b82f6'
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={`h-full ${isWorking ? 'animate-pulse' : ''}`}
                      />
                    </div>

                    {/* Status Pill Indicator (Centered) */}
                    <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                      <div className="animate-in fade-in zoom-in slide-in-from-bottom-2 duration-500">
                        <span className={`text-[11px] font-black px-4 py-1.5 rounded-full border shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-500 ${
                          isCompleted ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                          isWorking ? 'bg-primary/20 text-primary border-primary/40 animate-pulse scale-110' :
                          'bg-white/10 text-white/30 border-white/10'
                        }`}>
                          {isCompleted ? 'STATE CONFIRMED' :
                           isWorking ? (bulkActionType === 'enable' ? 'IGNITING MODULE' : 'EXTINGUISHING MODULE') :
                           'COMMAND QUEUED'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Checkbox Overlay */}
                <div className={`absolute top-0 left-0 p-3 z-10 transition-opacity duration-300 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                }`}>
                  <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                    isSelected ? 'bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]' : 'border-white/20'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>

                {/* Real-time Health Pulse */}
                <div className="absolute top-0 right-0 p-3 flex items-center gap-2">
                  <StatusBadge status={app.environments.production.status} />
                </div>

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors">
                        {app.displayName}
                      </h3>
                      {health?.appVersion && health.appVersion !== 'unknown' && (
                        <span className="text-[10px] font-mono text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                          v{health.appVersion}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-white/30 font-mono">
                        {app.database}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        health?.status === 'UP' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                      }`}>
                        {health?.status || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-white/40">
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">Process</span>
                    <span className="text-[10px] font-mono text-white/60">
                      {health?.status === 'UP' ? `PID:${health.pid || '?'} | PORT:${health?.port || '?'}` : `PORT:${health?.port || '?'}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">Latency</span>
                    <span className={`text-[10px] font-mono ${
                      !health?.latency ? 'text-white/20' :
                      health.latency < 50 ? 'text-green-400' : 
                      health.latency < 150 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {health?.latency ? `${health.latency}ms` : '--'}
                    </span>
                  </div>
                </div>

                {/* Hive Controls */}
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAction(id, health?.status === 'UP' ? 'stop' : 'start')}
                      disabled={isWorking}
                      className={`p-2 rounded-lg transition-all ${
                        health?.status === 'UP' 
                          ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' 
                          : 'text-green-400 bg-green-400/10 hover:bg-green-400/20'
                      } disabled:opacity-50`}
                      title={health?.status === 'UP' ? 'Stop App' : 'Start App'}
                    >
                      {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : (health?.status === 'UP' ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />)}
                    </button>
                    <button
                      onClick={() => handleAction(id, 'restart')}
                      disabled={isWorking || health?.status !== 'UP'}
                      className="p-2 text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-all disabled:opacity-30"
                      title="Restart App"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openLogs(id)}
                      className="p-2 text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 rounded-lg transition-all"
                      title="View Logs"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                  </div>

                  <Link
                    to="/deploy"
                    className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-primary transition-colors font-medium"
                  >
                    Details
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-white/80 mb-4">System Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/deploy" className="glass-card p-5 flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">Batch Deploy</p>
              <p className="text-xs text-white/30">Trigger all suite releases</p>
            </div>
          </Link>

          <Link to="/themes" className="glass-card p-5 flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">Theme Studio</p>
              <p className="text-xs text-white/30">Edit design tokens</p>
            </div>
          </Link>

          <div className="glass-card p-5 flex items-center gap-4 group cursor-pointer">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
              <RefreshCw className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">Sync Bridge</p>
              <p className="text-xs text-white/30">Pull Persona config</p>
            </div>
          </div>
        </div>
      </div>

      {/* Log Modal */}
      <AnimatePresence>
        {selectedLogApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-auto bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border-primary/20"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20 backdrop-blur-md rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Terminal className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                      {selectedLogApp} <span className="text-primary/60">— LIVE TELEMETRY</span>
                    </h2>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Sovereign Hive Monitor :: Raw Stream</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedLogApp(null);
                    setLogs('');
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-all group"
                >
                  <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 font-mono text-sm">
                {loadingLogs ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <span className="text-[10px] font-bold text-primary tracking-[0.3em] animate-pulse">STREAMING DATA...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.split('\n').map((line, i) => (
                      <div key={i} className="flex gap-4 group hover:bg-white/5 p-1 rounded transition-colors">
                        <span className="text-white/10 select-none w-10 text-right shrink-0">{i + 1}</span>
                        <span className="text-white/70 break-all leading-relaxed font-mono">{line || ' '}</span>
                      </div>
                    ))}
                    {logs === '' && <p className="text-white/20 italic">No telemetry stream available for this module.</p>}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => openLogs(selectedLogApp)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold transition-all border border-white/10"
                >
                  REFRESH STREAM
                </button>
                <button
                  onClick={() => {
                    setSelectedLogApp(null);
                    setLogs('');
                  }}
                  className="px-6 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold transition-all border border-primary/30 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]"
                >
                  CLOSE MONITOR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  icon,
  label,
  value,
  accent,
  isText,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
  isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    success: 'text-green-400 bg-green-400/10',
    danger: 'text-red-400 bg-red-400/10',
    warning: 'text-amber-400 bg-amber-400/10',
    info: 'text-cyan-400 bg-cyan-400/10',
  };

  return (
    <div className="glass-card-static p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[accent]}`}>
          {icon}
        </div>
        <span className="premium-label uppercase tracking-widest text-[10px]">{label}</span>
      </div>
      <p className={`font-bold ${isText ? 'text-lg text-white/60' : 'text-3xl text-white/90'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live: 'badge-success',
    deploying: 'badge-warning',
    failed: 'badge-danger',
    'not-configured': 'badge-info',
  };

  return (
    <span className={`badge uppercase tracking-[0.15em] font-black text-[9px] ${styles[status] || 'badge-info'}`}>
      <span className={`status-dot ${
        status === 'live' ? 'status-dot-live' :
        status === 'deploying' ? 'status-dot-deploying' :
        status === 'failed' ? 'status-dot-failed' :
        'status-dot-queued'
      }`} />
      {status}
    </span>
  );
}
