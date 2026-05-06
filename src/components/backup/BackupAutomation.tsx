import React from 'react';
import { 
  Clock, 
  Play, 
  Pause, 
  Edit3, 
  Trash2, 
  Calendar, 
  CalendarCheck, 
  Zap, 
  Info, 
  ChevronDown, 
  Activity, 
  RefreshCw, 
  ShieldCheck,
  Check
} from 'lucide-react';
import type { BackupFile, BackupEvent } from '../../types/backup';
import { format } from 'date-fns';

interface BackupAutomationProps {
  activeTab: string;
  schedules: any[];
  activeOperations: any[];
  routinesCollapsed: boolean;
  setRoutinesCollapsed: (v: boolean) => void;
  selectedRoutines: Set<string>;
  setSelectedRoutines: (v: Set<string>) => void;
  isRoutineRunning: (s: any) => boolean;
  renamingScheduleId: string | null;
  setRenamingScheduleId: (id: string | null) => void;
  renamingName: string;
  setRenamingName: (n: string) => void;
  handleRename: (id: string) => void;
  fetchSchedules: () => void;
  runBackup: (force?: boolean, skip?: boolean, customParams?: any) => void;
  setRoutineDeleteModal: (v: any) => void;
  editingRoutineId: string | null;
  setEditingRoutineId: (id: string | null) => void;
  newScheduleName: string;
  setNewScheduleName: (n: string) => void;
  newCron: string;
  setNewCron: (c: string) => void;
  newScope: 'FullSuite' | 'Selection';
  setNewScope: (s: 'FullSuite' | 'Selection') => void;
  newIncludeStorage: boolean;
  setNewIncludeStorage: (v: boolean) => void;
  selectedApps: string[];
  setSelectedApps: (v: string[]) => void;
  scopeSelectorCollapsed: boolean;
  setScopeSelectorCollapsed: (v: boolean) => void;
  currentSuite: any;
  operationsCollapsed: boolean;
  setOperationsCollapsed: (v: boolean) => void;
  selectedOps: Set<string>;
  setSelectedOps: (v: Set<string>) => void;
  setCancelConfirmModal: (v: any) => void;
  running: boolean;
  API_URL: string;
}

const BackupAutomation: React.FC<BackupAutomationProps> = ({
  activeTab,
  schedules,
  activeOperations,
  routinesCollapsed,
  setRoutinesCollapsed,
  selectedRoutines,
  setSelectedRoutines,
  isRoutineRunning,
  renamingScheduleId,
  setRenamingScheduleId,
  renamingName,
  setRenamingName,
  handleRename,
  fetchSchedules,
  runBackup,
  setRoutineDeleteModal,
  editingRoutineId,
  setEditingRoutineId,
  newScheduleName,
  setNewScheduleName,
  newCron,
  setNewCron,
  newScope,
  setNewScope,
  newIncludeStorage,
  setNewIncludeStorage,
  selectedApps,
  setSelectedApps,
  scopeSelectorCollapsed,
  setScopeSelectorCollapsed,
  currentSuite,
  operationsCollapsed,
  setOperationsCollapsed,
  selectedOps,
  setSelectedOps,
  setCancelConfirmModal,
  running,
  API_URL
}) => {
  if (activeTab !== 'automation') return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Main Column */}
      <div className="lg:col-span-2 space-y-6">

        {/* Active Routines Section */}
        <div className="space-y-4">
          <div
            onClick={() => setRoutinesCollapsed(!routinesCollapsed)}
            className="flex items-center justify-between w-full group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest group-hover:text-white/40 transition-colors">Active Routines</h3>
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                {schedules.length} Active
              </span>
              {schedules.length > 0 && !routinesCollapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const allIds = schedules.map(s => s.id);
                    if (selectedRoutines.size === allIds.length) setSelectedRoutines(new Set());
                    else setSelectedRoutines(new Set(allIds));
                  }}
                  className="text-[10px] text-primary/40 hover:text-primary font-bold uppercase tracking-widest underline underline-offset-4 transition-colors"
                >
                  {selectedRoutines.size === schedules.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            <div className={`p-1 rounded-md hover:bg-white/5 transition-all ${!routinesCollapsed ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-white/20" />
            </div>
          </div>

          {!routinesCollapsed && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {/* Bulk Action for Routines */}
                {selectedRoutines.size > 0 && (
                  <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">{selectedRoutines.size} Routines Selected</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          for (const id of Array.from(selectedRoutines)) {
                            await fetch(`${API_URL}/api/schedules/${id}/toggle-pause`, { method: 'POST' });
                          }
                          setSelectedRoutines(new Set());
                          fetchSchedules();
                        }}
                        className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Toggle Selected
                      </button>
                      <button
                        onClick={async () => {
                          setRoutineDeleteModal({ open: true, ids: Array.from(selectedRoutines) });
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                      >
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}

                {schedules.length > 0 ? (
                  schedules.map((s) => (
                    <div key={s.id} className={`glass-card-static p-6 flex items-center justify-between group transition-all ${isRoutineRunning(s) ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/5' : 'hover:border-primary/20'} ${selectedRoutines.has(s.id) ? 'border-primary/60 bg-primary/5' : ''}`}>
                      <div className="flex items-center gap-6 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedRoutines.has(s.id)}
                          onChange={(e) => {
                            const next = new Set(selectedRoutines);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            setSelectedRoutines(next);
                          }}
                          className="w-4 h-4 rounded-full border-white/10 bg-white/5 text-primary focus:ring-primary/50 cursor-pointer"
                        />
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-primary border transition-all ${isRoutineRunning(s) ? 'bg-primary/20 border-primary/30 animate-pulse' : 'bg-primary/10 border-primary/10'}`}>
                          <Clock className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-[10px]">
                            {renamingScheduleId === s.id ? (
                              <input
                                autoFocus
                                value={renamingName}
                                onChange={(e) => setRenamingName(e.target.value)}
                                onBlur={() => handleRename(s.id)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename(s.id)}
                                className="bg-white/5 border-primary/30 border rounded text-sm font-bold text-white px-2 py-0.5 outline-none focus:border-primary w-48 animate-in fade-in zoom-in-95 duration-200"
                              />
                            ) : (
                              <h4
                                onClick={() => {
                                  setRenamingScheduleId(s.id);
                                  setRenamingName(s.name || s.scope);
                                }}
                                className={`text-sm font-bold cursor-pointer hover:text-primary transition-all ${s.status === 'paused' ? 'text-white/20' : 'text-white/90'}`}
                              >
                                {s.name || 'Untitled Routine'}
                              </h4>
                            )}
                            <span className="text-[10px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/40 uppercase tracking-widest mr-[10px]">
                              {s.cronExpression}
                            </span>
                            {s.status === 'paused' && (
                              <span className="text-[9px] font-black bg-orange-500/10 text-orange-400 px-[10px] py-0.5 rounded border border-orange-500/20 uppercase tracking-widest">
                                Paused
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-5 mt-1.5">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                              Last Run: <span className="text-white/50">{s.lastRun ? format(new Date(s.lastRun), 'MMM dd, HH:mm') : 'Never'}</span>
                            </p>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                              Storage: <span className={s.includeStorage ? 'text-green-400' : 'text-red-400'}>{s.includeStorage ? 'Included' : 'Excluded'}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-[10px]">
                        <button
                          onClick={() => runBackup(false, false, { scope: s.scope, name: s.name, appIds: s.appIds, includeStorage: s.includeStorage })}
                          disabled={running}
                          className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        <button
                          onClick={() => setEditingRoutineId(s.id)}
                          className="p-2.5 rounded-xl bg-white/5 text-white/40 border border-transparent hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRoutineDeleteModal({ open: true, ids: [s.id] })}
                          className="p-2.5 rounded-xl bg-white/5 text-white/20 border border-transparent hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="glass-card-static p-20 flex flex-col items-center justify-center text-center">
                    <Calendar className="w-8 h-8 text-white/10 mb-4" />
                    <h4 className="text-white/60 font-bold mb-2">No Automated Routines</h4>
                    <p className="text-white/30 text-xs">Configure your first routine on the right.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Operations Section */}
        <div className="space-y-4">
          <div
            onClick={() => setOperationsCollapsed(!operationsCollapsed)}
            className="flex items-center justify-between w-full group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 group-hover:text-primary/70 transition-colors">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Live Operations
              </h3>
              {activeOperations.length > 0 && (
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                  {activeOperations.length} Active
                </span>
              )}
            </div>
            <div className={`p-1 rounded-md hover:bg-white/5 transition-all ${!operationsCollapsed ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-white/20" />
            </div>
          </div>

          {!operationsCollapsed && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {activeOperations.length > 0 ? (
                  activeOperations.map((op) => (
                    <div key={op.id} className="relative group flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-primary/20 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              op.status === 'failed' ? 'bg-red-500' : 
                              op.status === 'complete' ? 'bg-green-500' : 
                              op.status === 'pending' ? 'bg-orange-500' : 
                              'bg-primary'
                            }`}></span>
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                              op.status === 'failed' ? 'bg-red-500' : 
                              op.status === 'complete' ? 'bg-green-500' : 
                              op.status === 'pending' ? 'bg-orange-500' : 
                              'bg-primary'
                            }`}></span>
                          </span>
                          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.15em]">{op.type}</h4>
                          <span className="text-[9px] text-primary/60 font-mono">{op.id}</span>
                        </div>
                        <p className="text-xs text-white/60 truncate">{op.message}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-primary tabular-nums">{Math.round(op.progress)}%</span>
                          <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-700 ${
                                op.status === 'failed' ? 'bg-red-500' : 
                                op.status === 'complete' ? 'bg-green-500' : 
                                op.status === 'pending' ? 'bg-orange-500' : 
                                'bg-primary'
                              }`}
                              style={{ width: `${op.progress}%` }}
                            />
                          </div>
                      </div>
                      <button
                        onClick={() => setCancelConfirmModal({ open: true, ids: [op.id], type: 'single' })}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="glass-card-static p-12 flex flex-col items-center justify-center text-center opacity-40">
                    <RefreshCw className="w-8 h-8 text-white/10 mb-4 animate-spin-slow" />
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">No active background tasks</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column (Sidebars) */}
      <div className="space-y-6">
        <div className={`glass-card-static p-6 space-y-6 transition-all ${editingRoutineId ? 'bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20' : 'bg-gradient-to-br from-primary/10 to-transparent border-primary/20'}`}>
          <div className={`flex items-center justify-between ${editingRoutineId ? 'text-orange-400' : 'text-primary'}`}>
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">{editingRoutineId ? 'Edit Routine' : 'New Routine'}</h3>
            </div>
            {editingRoutineId && (
              <button
                onClick={() => setEditingRoutineId(null)}
                className="text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-2 block">Routine Title</label>
              <input
                type="text"
                value={newScheduleName}
                onChange={(e) => setNewScheduleName(e.target.value)}
                placeholder="e.g., Daily Full Backup"
                className="w-full bg-black/40 border-white/10 rounded-xl text-xs text-white p-3 focus:ring-primary/40 transition-all focus:border-primary/40 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-3 block">Backup Scope</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                <button
                  onClick={() => setNewScope('FullSuite')}
                  className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${newScope === 'FullSuite' ? 'bg-primary text-white shadow-lg' : 'text-white/40'}`}
                >
                  Full Suite
                </button>
                <button
                  onClick={() => setNewScope('Selection')}
                  className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${newScope === 'Selection' ? 'bg-primary text-white shadow-lg' : 'text-white/40'}`}
                >
                  Selection
                </button>
              </div>

              {newScope === 'Selection' && (
                <div className="mt-3 bg-black/40 rounded-xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <button
                    onClick={() => setScopeSelectorCollapsed(!scopeSelectorCollapsed)}
                    className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">Select Apps</span>
                      <span className="text-[9px] text-primary/40 bg-primary/5 px-1.5 py-0.5 rounded font-mono">
                        {selectedApps.length}
                      </span>
                    </div>
                    <div className={`transition-transform duration-300 ${scopeSelectorCollapsed ? '' : 'rotate-180'}`}>
                      <ChevronDown className="w-3.5 h-3.5 text-white/20" />
                    </div>
                  </button>

                  {!scopeSelectorCollapsed && (
                    <div className="p-3 pt-0 space-y-2 animate-in slide-in-from-top-2 duration-300 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] text-white/20 uppercase tracking-tighter">Choose target applications</span>
                        {currentSuite && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const allIds = Object.keys(currentSuite.apps);
                              if (selectedApps.length === allIds.length) setSelectedApps([]);
                              else setSelectedApps(allIds);
                            }}
                            className="text-[9px] uppercase tracking-wider text-primary hover:text-primary/70 font-bold transition-colors"
                          >
                            {selectedApps.length === Object.keys(currentSuite.apps).length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {currentSuite && Object.entries(currentSuite.apps).map(([id, app]: [string, any]) => (
                          <label key={id} className="flex items-center gap-3 p-1.5 rounded hover:bg-white/5 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedApps.includes(id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedApps([...selectedApps, id]);
                                else setSelectedApps(selectedApps.filter(a => a !== id));
                              }}
                              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                            />
                            <span className="text-[10px] text-white/60 truncate">{app.displayName}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Include Storage</span>
              </div>
              <button
                onClick={() => setNewIncludeStorage(!newIncludeStorage)}
                className={`w-10 h-5 rounded-full transition-all relative ${newIncludeStorage ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${newIncludeStorage ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-2 block">Cron Expression</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                  placeholder="0 0 * * *"
                  className="flex-1 bg-black/40 border-white/10 rounded-xl text-xs text-white p-3 outline-none"
                />
                <button
                  onClick={async () => {
                    const payload = {
                      name: newScheduleName.trim(),
                      cronExpression: newCron.trim(),
                      scope: newScope === 'Selection' ? 'CustomSelection' : 'StillwaterSuite',
                      appIds: newScope === 'Selection' ? selectedApps : undefined,
                      includeStorage: newIncludeStorage
                    };
                    await fetch(`${API_URL}/api/schedules${editingRoutineId ? `/${editingRoutineId}` : ''}`, {
                      method: editingRoutineId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    setEditingRoutineId(null);
                    setNewScheduleName('');
                    setNewCron('');
                    fetchSchedules();
                  }}
                  className={`px-4 py-3 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest ${editingRoutineId ? 'bg-orange-500' : 'bg-primary'}`}
                >
                  {editingRoutineId ? 'Save' : 'Create'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setNewCron('*/1 * * * *')} className="p-2 rounded-lg bg-white/5 text-[9px] font-bold text-white/40 hover:text-white transition-colors">1 Min</button>
              <button onClick={() => setNewCron('*/5 * * * *')} className="p-2 rounded-lg bg-white/5 text-[9px] font-bold text-white/40 hover:text-white transition-colors">5 Min</button>
              <button onClick={() => setNewCron('0 0 * * *')} className="p-2 rounded-lg bg-white/5 text-[9px] font-bold text-white/40 hover:text-white transition-colors">Daily</button>
            </div>
          </div>
        </div>

        <div className="glass-card-static p-6 bg-white/5 border-dashed border-white/10">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-white/20 mt-0.5" />
            <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-wide">
              Scheduled backups run in the background and are synced to Cloud Registry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupAutomation;
