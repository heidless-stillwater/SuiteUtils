import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, 
  Activity, 
  Terminal, 
  Settings, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Cpu,
  Database,
  Cloud,
  X,
  Play,
  Square,
  RotateCcw,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProModeViewProps {
  apps: any[];
  infrastructure?: any[];
  healthResults: any[];
  onOpenLogs: (appId: string) => void;
  selectedIds: string[];
  toggleSelect: (appId: string) => void;
  handleAction: (appId: string, action: 'start' | 'stop' | 'restart') => void;
  handleBulkToggle: (enabled: boolean) => void;
  loadingAppId: string | null;
  completedIds: string[];
  bulkActionType: 'enable' | 'disable' | null;
}

export default function ProModeView({ 
  apps, 
  infrastructure = [],
  healthResults, 
  onOpenLogs,
  selectedIds,
  toggleSelect,
  handleAction,
  handleBulkToggle,
  loadingAppId,
  completedIds,
  bulkActionType
}: ProModeViewProps) {
  const [cardsPerRow, setCardsPerRow] = React.useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('hive-cards-per-row') || '4') || 4;
    }
    return 4;
  });

  // Collapsible sections state
  const [isAppsOpen, setIsAppsOpen] = React.useState(false);
  const [isInfraOpen, setIsInfraOpen] = React.useState(true);

  const handleCardsPerRowChange = (cols: number) => {
    setCardsPerRow(cols);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hive-cards-per-row', cols.toString());
    }
  };

  const [appOrder, setAppOrder] = React.useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hive-app-order');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return apps.map(([id]) => id);
  });

  const [infraOrder, setInfraOrder] = React.useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hive-infra-order');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return infrastructure.map(([id]) => id);
  });

  React.useEffect(() => {
    const currentIds = apps.map(([id]) => id);
    setAppOrder(prev => {
      const filtered = prev.filter(id => currentIds.includes(id));
      const missing = currentIds.filter(id => !filtered.includes(id));
      const merged = [...filtered, ...missing];
      if (JSON.stringify(prev) !== JSON.stringify(merged)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('hive-app-order', JSON.stringify(merged));
        }
        return merged;
      }
      return prev;
    });
  }, [apps]);

  React.useEffect(() => {
    const currentIds = infrastructure.map(([id]) => id);
    setInfraOrder(prev => {
      const filtered = prev.filter(id => currentIds.includes(id));
      const missing = currentIds.filter(id => !filtered.includes(id));
      const merged = [...filtered, ...missing];
      if (JSON.stringify(prev) !== JSON.stringify(merged)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('hive-infra-order', JSON.stringify(merged));
        }
        return merged;
      }
      return prev;
    });
  }, [infrastructure]);

  const handleShiftApp = (appId: string, direction: 'left' | 'right') => {
    const index = appOrder.indexOf(appId);
    if (index === -1) return;
    
    let newIndex = index;
    if (direction === 'left' && index > 0) newIndex = index - 1;
    else if (direction === 'right' && index < appOrder.length - 1) newIndex = index + 1;
    
    if (newIndex !== index) {
      const newOrder = [...appOrder];
      newOrder[index] = newOrder[newIndex];
      newOrder[newIndex] = appId;
      setAppOrder(newOrder);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hive-app-order', JSON.stringify(newOrder));
      }
    }
  };

  const handleShiftInfra = (appId: string, direction: 'left' | 'right') => {
    const index = infraOrder.indexOf(appId);
    if (index === -1) return;
    
    let newIndex = index;
    if (direction === 'left' && index > 0) newIndex = index - 1;
    else if (direction === 'right' && index < infraOrder.length - 1) newIndex = index + 1;
    
    if (newIndex !== index) {
      const newOrder = [...infraOrder];
      newOrder[index] = newOrder[newIndex];
      newOrder[newIndex] = appId;
      setInfraOrder(newOrder);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hive-infra-order', JSON.stringify(newOrder));
      }
    }
  };

  const GRID_COLUMNS_MAP: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
  };

  const getHealth = (appId: string) => {
    return healthResults.find(h => h.appId.toLowerCase() === appId.toLowerCase());
  };

  const handleSelectAll = () => {
    const allIds = [...apps.map(([appId]) => appId), ...infrastructure.map(([appId]) => appId)];
    const allSelected = allIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      allIds.forEach(id => {
        if (selectedIds.includes(id)) toggleSelect(id);
      });
    } else {
      allIds.forEach(id => {
        if (!selectedIds.includes(id)) toggleSelect(id);
      });
    }
  };

  const handleClearSelection = () => {
    const allIds = [...apps.map(([appId]) => appId), ...infrastructure.map(([appId]) => appId)];
    allIds.forEach(appId => {
      if (selectedIds.includes(appId)) toggleSelect(appId);
    });
  };

  const renderCard = (appId: string, index: number, isInfra: boolean) => {
    const list = isInfra ? infrastructure : apps;
    const orderList = isInfra ? infraOrder : appOrder;
    const shiftHandler = isInfra ? handleShiftInfra : handleShiftApp;
    
    const appEntry = list.find(([id]) => id === appId);
    if (!appEntry) return null;
    const [_, config] = appEntry;
    const health = getHealth(appId);
    const isUp = health?.status === 'UP' || appId.toLowerCase() === 'suiteutils';
    const LINKED_MODULES: Record<string, string> = {
      'suiteutils': 'suiteutils-api',
      'suiteutils-api': 'suiteutils',
      'persona': 'persona-bridge',
      'persona-bridge': 'persona'
    };
    const linkedId = LINKED_MODULES[appId];

    const isSelected = selectedIds.includes(appId);
    const isWorking = loadingAppId === appId || (loadingAppId !== null && loadingAppId === linkedId);
    const isCompleted = completedIds.includes(appId) || (linkedId !== undefined && completedIds.includes(linkedId));
    
    return (
      <motion.div 
        key={appId} 
        layout
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          toggleSelect(appId);
        }}
        className={`glass-card p-5 group relative overflow-hidden cursor-pointer transition-all duration-500 ${
          isWorking ? 'border-primary/60 bg-primary/20 ring-2 ring-primary/40 shadow-[0_0_40px_rgba(var(--primary-rgb),0.3)]' : 
          isSelected ? 'border-indigo-400/50 bg-indigo-400/10 ring-1 ring-indigo-400/30 shadow-[0_0_20px_rgba(129,140,248,0.15)]' :
          (health?.status === 'UP') ? 'border-primary/30 bg-primary/10 shadow-[inset_0_0_20px_rgba(var(--primary-rgb),0.15),0_0_15px_rgba(var(--primary-rgb),0.1)]' :
          'hover:border-white/10'
        }`}
      >
        {/* Orchestration Telemetry Overlay */}
        {(isWorking || isCompleted) && (
          <div className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="absolute bottom-0 left-0 w-full h-2 bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ 
                  width: isCompleted ? '100%' : isWorking ? '92%' : '8%',
                  backgroundColor: isCompleted ? '#4ade80' : '#3b82f6'
                }}
                transition={{ 
                  width: { duration: isCompleted ? 0.3 : 20, ease: isCompleted ? "easeOut" : "linear" },
                  backgroundColor: { duration: 0.3 }
                }}
                className="h-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              />
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {isCompleted ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                )}
              </div>
              
              <div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isCompleted ? 'text-green-400' : 'text-primary animate-pulse'}`}>
                  {isCompleted ? 'State Confirmed' : (isUp ? 'Extinguishing...' : 'Probing Port...')}
                </span>
                <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest mt-1">
                  Neural Link :: {appId}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Selection Checkbox Overlay */}
        <div className={`absolute top-0 left-0 p-3 z-10 transition-opacity duration-300 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
        }`}>
          <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
            isWorking ? 'bg-primary border-primary' :
            isSelected ? 'bg-indigo-50 border-indigo-50' : 'border-white/20'
          }`}>
            {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
        </div>

        {/* Shift Controls Overlay */}
        <div className="absolute top-0 right-0 p-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {index > 0 && (
            <div className="relative group/btn">
              <button 
                onClick={(e) => { e.stopPropagation(); shiftHandler(appId, 'left'); }}
                className="p-1 rounded-md bg-black/40 hover:bg-white/10 text-white/40 hover:text-white transition-all backdrop-blur-md border border-white/5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-black/90 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/80 rounded-lg opacity-0 pointer-events-none group-hover/btn:opacity-100 transition-all duration-300 whitespace-nowrap shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-md">
                Shift Earlier
              </div>
            </div>
          )}
          {index < orderList.length - 1 && (
            <div className="relative group/btn">
              <button 
                onClick={(e) => { e.stopPropagation(); shiftHandler(appId, 'right'); }}
                className="p-1 rounded-md bg-black/40 hover:bg-white/10 text-white/40 hover:text-white transition-all backdrop-blur-md border border-white/5"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-black/90 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/80 rounded-lg opacity-0 pointer-events-none group-hover/btn:opacity-100 transition-all duration-300 whitespace-nowrap shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-md">
                Shift Later
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
            isUp 
              ? 'bg-primary/20 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]' 
              : 'bg-white/5 text-white/20'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${isUp ? 'text-primary' : 'text-white/20'}`}>
              {isUp ? 'MODULE ACTIVE' : 'MODULE OFFLINE'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]' : 'bg-white/10'}`} />
              <span className={`text-[8px] font-mono transition-colors duration-500 ${isUp ? 'text-primary/60' : 'text-white/20'}`}>
                {health?.latency ? `${health.latency}ms` : '--'}
              </span>
            </div>
          </div>
        </div>

        <h3 className="text-sm font-bold text-white/90 mb-1 uppercase tracking-tight truncate group-hover:text-primary transition-colors">
          {config.displayName || config.name || appId}
        </h3>
        <p className="text-[10px] text-white/30 font-mono mb-4 truncate">{config.path}</p>

        {/* High-Density Telemetry Block */}
        <div className="space-y-2 text-[10px] text-white/40 font-mono bg-black/40 p-3 rounded-lg mb-4 border border-white/5 backdrop-blur-md">
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/20 uppercase tracking-tighter">Process</span>
            <span className="text-white/60">
              {`PID:${health?.pid ?? '?'} | PORT:${health?.port ?? '?'}`}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-white/20 uppercase tracking-tighter">Version</span>
            <span className="text-primary/60 font-black">v{health?.appVersion || '1.0.0'}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-1.5">
            <button
              onClick={() => handleAction(appId, isUp ? 'stop' : 'start')}
              disabled={isWorking}
              className={`p-2 rounded-lg transition-all ${
                isUp 
                  ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' 
                  : 'text-primary bg-primary/10 hover:bg-primary/20'
              } border border-transparent hover:border-current/20 disabled:opacity-50`}
              title={isWorking ? "Orchestrating..." : (isUp ? "Extinguish Module" : "Ignite Module")}
            >
              {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isUp ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />)}
            </button>
            <button
              onClick={() => handleAction(appId, 'restart')}
              disabled={isWorking || !isUp}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all border border-white/5 disabled:opacity-20"
              title="Reboot Module"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => onOpenLogs(appId)}
              className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 text-white/30 hover:text-primary transition-all border border-white/5 hover:border-primary/40"
              title="Terminal Stream"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <Link
            to={appId === 'persona' ? "/persona" : "/deploy"}
            className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-primary transition-colors font-bold uppercase tracking-widest"
          >
            {appId === 'persona' ? "Intelligence Core" : "Details"}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* System Pulse Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'System Load', value: 'Nominal', icon: <Cpu className="w-4 h-4" />, color: 'text-primary' },
          { label: 'DB Latency', value: '14ms', icon: <Database className="w-4 h-4" />, color: 'text-green-400' },
          { label: 'Cloud Status', value: 'Verified', icon: <Cloud className="w-4 h-4" />, color: 'text-primary' },
          { label: 'HIVE VERSION', value: '1.1 - ARCHITECT', icon: <Activity className="w-4 h-4" />, color: 'text-primary' }
        ].map((stat, i) => (
          <div key={i} className="glass-card-static p-4 flex items-center justify-between border-b-2 border-primary/20">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{stat.label}</p>
              <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Sovereign Hive Operations Cockpit */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-white/[0.02] border border-white/5 backdrop-blur-2xl rounded-[2rem] shadow-[inset_0_0_30px_rgba(255,255,255,0.01),0_10px_30px_-10px_rgba(0,0,0,0.3)] gap-6">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center shrink-0">
            <div className={`absolute inset-0 rounded-xl bg-primary/20 blur-md transition-opacity ${selectedIds.length > 0 ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
              selectedIds.length > 0 ? 'bg-primary/20 border-primary/40 text-primary animate-pulse shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' : 'bg-white/5 border-white/5 text-white/30'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Hive Operations</span>
            <span className="text-[11px] text-white/80 font-black uppercase tracking-widest mt-0.5">
              {selectedIds.length > 0 ? `${selectedIds.length} of ${apps.length + infrastructure.length} Modules Selected` : 'Select Modules to Synchronize'}
            </span>
          </div>
          {selectedIds.length > 0 && (
            <>
              <div className="h-8 w-px bg-white/10 mx-2 hidden md:block" />
              <div className="relative group">
                <button
                  onClick={handleClearSelection}
                  className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/90 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/80 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 whitespace-nowrap shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-md">
                  Clear active selections
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Select All Action */}
          <div className="relative group">
            <button
              onClick={handleSelectAll}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                selectedIds.length === (apps.length + infrastructure.length)
                  ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${
                selectedIds.length === (apps.length + infrastructure.length) ? 'bg-primary border-primary' : 'border-white/20'
              }`}>
                {selectedIds.length === (apps.length + infrastructure.length) && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {selectedIds.length === (apps.length + infrastructure.length) ? 'Deselect All' : 'Select All'}
              </span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/90 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/80 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 whitespace-nowrap shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-md">
              {selectedIds.length === (apps.length + infrastructure.length) ? 'Clear all selected modules' : `Select all ${apps.length + infrastructure.length} registered modules`}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
            </div>
          </div>

          {/* Ignite Selected Action */}
          <div className="relative group">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={selectedIds.length === 0 || bulkActionType !== null}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                selectedIds.length > 0 && bulkActionType === null
                  ? 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]'
                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed opacity-50'
              }`}
            >
              {bulkActionType === 'enable' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Ignite Selected
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/90 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/80 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 whitespace-nowrap shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-md">
              {selectedIds.length === 0
                ? 'Select modules below to ignite them'
                : `Ignite processes for all ${selectedIds.length} selected modules`}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
            </div>
          </div>

          {/* Extinguish Selected Action */}
          <div className="relative group">
            <button
              onClick={() => handleBulkToggle(false)}
              disabled={selectedIds.length === 0 || bulkActionType !== null}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                selectedIds.length > 0 && bulkActionType === null
                  ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed opacity-50'
              }`}
            >
              {bulkActionType === 'disable' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Square className="w-3.5 h-3.5 fill-current" />
              )}
              Extinguish Selected
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/90 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/80 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 whitespace-nowrap shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-md">
              {selectedIds.length === 0
                ? 'Select modules below to extinguish them'
                : `Safely terminate processes for all ${selectedIds.length} selected modules`}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
            </div>
          </div>

          {/* Card Density / Grid Columns Selector */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 shadow-lg">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 pl-3.5 pr-2">Grid Layout</span>
            {[1, 2, 3, 4, 5].map((cols) => (
              <button
                key={cols}
                type="button"
                onClick={() => handleCardsPerRowChange(cols)}
                className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                  cardsPerRow === cols 
                    ? 'bg-primary text-black shadow-[0_0_12px_rgba(var(--primary-rgb),0.35)]' 
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
                title={`Show ${cols} card${cols > 1 ? 's' : ''} per row`}
              >
                {cols}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Applications Section */}
      <div className="space-y-4">
        <button
          onClick={() => setIsAppsOpen(!isAppsOpen)}
          className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 text-primary border border-primary/20 transition-transform duration-300 ${isAppsOpen ? 'rotate-90' : ''}`}>
              <ChevronRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white/90">Applications</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-0.5">
                {apps.length} Module{apps.length > 1 ? 's' : ''} Registered
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">
              {apps.filter(([id]) => getHealth(id)?.status === 'UP').length} Active
            </span>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isAppsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className={`grid ${GRID_COLUMNS_MAP[cardsPerRow] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-4 pt-2 pb-6`}>
                {appOrder.map((appId, index) => renderCard(appId, index, false))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Infrastructure Section */}
      <div className="space-y-4">
        <button
          onClick={() => setIsInfraOpen(!isInfraOpen)}
          className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 text-primary border border-primary/20 transition-transform duration-300 ${isInfraOpen ? 'rotate-90' : ''}`}>
              <ChevronRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white/90">Infrastructure Services</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-0.5">
                {infrastructure.length} Service{infrastructure.length > 1 ? 's' : ''} Monitored
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">
              {infrastructure.filter(([id]) => getHealth(id)?.status === 'UP').length} Active
            </span>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isInfraOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className={`grid ${GRID_COLUMNS_MAP[cardsPerRow] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-4 pt-2 pb-6`}>
                {infraOrder.map((appId, index) => renderCard(appId, index, true))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Maintenance Controls */}
      <div className="p-6 glass-card border-primary/20 bg-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <RefreshCw className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h4 className="font-bold text-white">Full Suite Synchronization</h4>
            <p className="text-xs text-white/40">Force global health check and neural cache invalidation.</p>
          </div>
        </div>
        <button className="px-6 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold transition-all border border-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
          EXECUTE RESYNC
        </button>
      </div>
    </motion.div>
  );
}
