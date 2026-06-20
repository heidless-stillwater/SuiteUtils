import React from 'react';
import { createPortal } from 'react-dom';
import { 
  Zap, 
  ChevronDown, 
  Loader2, 
  Search, 
  Activity, 
  Check, 
  ArrowUpRight, 
  AlertTriangle, 
  Trash2, 
  Clock, 
  Play, 
  XCircle,
  RotateCcw,
  ShieldCheck,
  Cloud
} from 'lucide-react';
import { format } from 'date-fns';

interface BackupModalsProps {
  migrateModal: { open: boolean; cloudPaths: string[]; workspaces: any[]; hasStorage?: boolean };
  setMigrateModal: (v: any) => void;
  selectedTargetWorkspace: string;
  setSelectedTargetWorkspace: (v: string) => void;
  analyzingMigration: boolean;
  runMigrationAnalysis: () => void;
  migrationAnalysis: any[] | null;
  confirmMigrationOverwrite: boolean;
  setConfirmMigrationOverwrite: (v: boolean) => void;
  handleMigrate: () => void;
  conflictModal: any;
  setConflictModal: (v: any) => void;
  runBackup: (force?: boolean, skip?: boolean, customParams?: any) => void;
  deleteConfirmModal: any;
  setDeleteConfirmModal: (v: any) => void;
  setSelectedBackups: (v: Set<string>) => void;
  fetchBackups: (status: 'active' | 'archived') => void;
  activeTab: string;
  cancelConfirmModal: any;
  setCancelConfirmModal: (v: any) => void;
  cancelBackup: () => void;
  selectedOps: Set<string>;
  setSelectedOps: (v: Set<string>) => void;
  restoreModal: { open: boolean; releaseId: string | null; cloudPath: string | null };
  setRestoreModal: (v: any) => void;
  confirmString: string;
  setConfirmString: (v: string) => void;
  handleRestore: () => void;
  routineDeleteModal: any;
  setRoutineDeleteModal: (v: any) => void;
  setSelectedRoutines: (v: Set<string>) => void;
  fetchSchedules: () => void;
  running: boolean;
  runningType: 'backup' | 'migration' | 'rollback';
  events: any[];
  API_URL: string;
  setLoading: (v: boolean) => void;
  setError: (err: string | null) => void;
  migrationResult: any | null;
  setMigrationResult: (res: any | null) => void;
}

const BackupModals: React.FC<BackupModalsProps> = ({
  migrateModal,
  setMigrateModal,
  selectedTargetWorkspace,
  setSelectedTargetWorkspace,
  analyzingMigration,
  runMigrationAnalysis,
  migrationAnalysis,
  confirmMigrationOverwrite,
  setConfirmMigrationOverwrite,
  handleMigrate,
  conflictModal,
  setConflictModal,
  runBackup,
  deleteConfirmModal,
  setDeleteConfirmModal,
  setSelectedBackups,
  fetchBackups,
  activeTab,
  cancelConfirmModal,
  setCancelConfirmModal,
  cancelBackup,
  selectedOps,
  setSelectedOps,
  restoreModal,
  setRestoreModal,
  confirmString,
  setConfirmString,
  handleRestore,
  routineDeleteModal,
  setRoutineDeleteModal,
  setSelectedRoutines,
  fetchSchedules,
  running,
  runningType,
  events,
  API_URL,
  setLoading,
  setError,
  migrationResult,
  setMigrationResult
}) => {
  const [mappingsCollapsed, setMappingsCollapsed] = React.useState(true);

  return (
    <>
      {migrateModal.open && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#050505] w-full max-w-md max-h-[90vh] flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border border-white/10 rounded-3xl relative overflow-hidden animate-in zoom-in duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 z-20" />
            <div className="p-6 pb-4 border-b border-white/5 bg-[#050505] z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Cross-Suite Migration</h2>
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Promote snapshots to another workspace</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[9px] uppercase tracking-widest text-white/20 font-black mb-1.5">Source Selection</p>
                <p className="text-xs font-bold text-white/90">
                  {migrateModal.cloudPaths.length === 1 
                    ? migrateModal.cloudPaths[0].split('/').filter(Boolean).pop() 
                    : `${migrateModal.cloudPaths.length} snapshots selected`}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-[9px] font-black uppercase tracking-widest text-white/20 ml-1">Target Workspace</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedTargetWorkspace}
                      onChange={e => {
                        const val = e.target.value;
                        setSelectedTargetWorkspace(val);
                      }}
                      className="w-full h-10 px-3 bg-black border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 appearance-none text-xs font-medium transition-all shadow-inner"
                    >
                      <option value="" className="bg-[#050505]">Select target...</option>
                      {migrateModal.workspaces.map(ws => (
                        <option key={ws.id} value={ws.id} className="bg-[#050505]">{ws.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
                  </div>
                  <button
                    id="analyze-migration-btn"
                    onClick={runMigrationAnalysis}
                    disabled={!selectedTargetWorkspace || analyzingMigration}
                    className="px-3 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all text-[10px] font-bold flex items-center gap-2 disabled:opacity-30"
                  >
                    {analyzingMigration ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Analyze
                  </button>
                </div>
              </div>

              {selectedTargetWorkspace && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col items-center justify-center space-y-1.5 animate-in zoom-in-95 duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-primary/60 relative z-10">
                    <Activity className="w-3 h-3" />
                    Target Infrastructure
                  </div>
                  <div className="text-2xl font-black text-white tracking-tighter uppercase italic drop-shadow-[0_0_10px_rgba(13,148,136,0.3)] relative z-10">
                    {migrateModal.workspaces.find(w => w.id === selectedTargetWorkspace)?.gcpProjectId || 'UNKNOWN'}
                  </div>
                </div>
              )}

              {migrationAnalysis && (
                <div className="p-4 bg-black rounded-xl border border-white/5 space-y-3 shadow-inner">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setMappingsCollapsed(!mappingsCollapsed)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors">Mappings</p>
                      <span className="text-[8px] text-green-400/60 font-bold uppercase tracking-widest bg-green-500/5 px-1.5 py-0.5 rounded">Validated</span>
                    </div>
                    <div className={`p-1 rounded-md hover:bg-white/5 transition-all ${!mappingsCollapsed ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-3.5 h-3.5 text-white/20" />
                    </div>
                  </div>
                  
                  {!mappingsCollapsed && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-300">
                      {migrationAnalysis.map((m: any) => (
                        <div key={m.sourceAppId} className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-white/60 font-mono font-medium">{m.sourceAppId}</span>
                            <div className="flex gap-1.5">
                              <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest ${
                                m.status === 'ready' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {m.status}
                              </span>
                              {m.dbStatus && (
                                <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest ${
                                  m.dbStatus === 'EXISTS_DATA' ? 'bg-orange-500/10 text-orange-400' : 
                                  m.dbStatus === 'EXISTS_EMPTY' ? 'bg-blue-500/10 text-blue-400' : 
                                  'bg-white/10 text-white/40'
                                }`}>
                                  {m.dbStatus === 'EXISTS_DATA' ? 'Conflict' : m.dbStatus === 'EXISTS_EMPTY' ? 'Empty' : 'New'}
                                </span>
                              )}
                            </div>
                          </div>
                          {m.drift && (
                            <div className="grid grid-cols-3 gap-1.5 text-[8px] font-bold uppercase tracking-tighter text-white/20">
                              <span className={m.drift.documents > 0 ? 'text-amber-400/60' : ''}>D: +{m.drift.documents}</span>
                              <span className={m.drift.users > 0 ? 'text-amber-400/60' : ''}>U: +{m.drift.users}</span>
                              <span className={m.drift.assets > 0 ? 'text-amber-400/60' : ''}>A: +{m.drift.assets}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {migrateModal.hasStorage && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3 shadow-inner animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/60">Global Assets</p>
                    <span className="text-[8px] text-blue-400/40 font-bold uppercase tracking-widest italic">Recursive Transfer</span>
                  </div>
                  <div className="flex items-center gap-4 p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-white/90">Cloud Storage Bucket</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-tighter">Full content replication</p>
                    </div>
                    <div className="px-2 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/10">
                      Ready
                    </div>
                  </div>
                </div>
              )}

              {migrationAnalysis && (
                <div className={`p-4 rounded-xl space-y-3 transition-colors ${
                  migrationAnalysis.some((m: any) => m.dbStatus === 'EXISTS_DATA') 
                    ? 'bg-orange-500/5 border border-orange-500/20' 
                    : 'bg-white/5 border border-white/10'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                      migrationAnalysis.some((m: any) => m.dbStatus === 'EXISTS_DATA') ? 'text-orange-400' : 'text-white/20'
                    }`} />
                    <p className={`text-[9px] leading-relaxed font-bold uppercase tracking-tight ${
                      migrationAnalysis.some((m: any) => m.dbStatus === 'EXISTS_DATA') ? 'text-orange-400' : 'text-white/40'
                    }`}>
                      {migrationAnalysis.some((m: any) => m.dbStatus === 'EXISTS_DATA') 
                        ? 'Destructive Overwrite Detected' 
                        : 'Safety Confirmation Required'}
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      confirmMigrationOverwrite ? 'bg-orange-500 border-orange-500' : 'border-white/20 bg-white/5'
                    }`}>
                      {confirmMigrationOverwrite && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={confirmMigrationOverwrite}
                      onChange={() => setConfirmMigrationOverwrite(!confirmMigrationOverwrite)}
                    />
                    <span className="text-[9px] text-white/60 group-hover:text-white/90 transition-colors font-medium">
                      I authorize the <span className="text-orange-400 font-black">REPLACEMENT</span> of all target data.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-6 pt-4 border-t border-white/5 bg-[#050505] flex gap-3">
              <button
                onClick={() => {
                  setMigrateModal({ open: false, cloudPaths: [], workspaces: [] });
                }}
                className="flex-1 h-11 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleMigrate}
                disabled={
                  !selectedTargetWorkspace || 
                  !migrationAnalysis || 
                  (migrationAnalysis.some((m: any) => m.dbStatus === 'EXISTS_DATA') && !confirmMigrationOverwrite)
                }
                className="flex-[2] h-11 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div className="flex items-center justify-center gap-2">
                  <ArrowUpRight className="w-4 h-4" />
                  Promote Snapshot
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {conflictModal && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#050505] max-w-md w-full p-8 border border-orange-500/30 space-y-6 shadow-2xl shadow-orange-500/10 rounded-[2.5rem]">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Active Job Conflict</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {conflictModal.message}
              </p>
            </div>

            {conflictModal.metadata && (
              <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Conflicting Job</span>
                  <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[8px] font-bold uppercase">Running Now</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white/80">{conflictModal.metadata.scope}</p>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    Apps: {conflictModal.metadata.appIds?.length > 0 ? conflictModal.metadata.appIds.join(', ') : 'Full Suite'}
                  </p>
                  <p className="text-[10px] text-white/40">
                    Storage: {conflictModal.metadata.includeStorage ? 'Included' : 'Excluded'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                onClick={() => {
                  const p = conflictModal.params;
                  setConflictModal(null);
                  runBackup(true, false, p.customParams);
                }}
                className="w-full py-4 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 group"
              >
                Force Terminate & Start
                <Play className="w-3 h-3 fill-current group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => {
                  const p = conflictModal.params;
                  setConflictModal(null);
                  runBackup(false, true, p.customParams);
                }}
                className="w-full py-4 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex flex-col items-center gap-1 group"
              >
                <span className="flex items-center gap-2">
                  Queue Operation
                  <Clock className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                </span>
                <span className="text-[8px] opacity-40 lowercase font-normal tracking-normal">Will start automatically after current job finishes</span>
              </button>
              <button
                onClick={() => setConflictModal(null)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
              >
                Cancel Request
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmModal && deleteConfirmModal.open && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#050505] max-w-md w-full p-8 border border-red-500/30 space-y-6 rounded-[2.5rem]">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Confirm Deletion</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Are you sure you want to permanently delete <span className="text-white font-bold">{deleteConfirmModal.ids.length}</span> snapshot{deleteConfirmModal.ids.length > 1 ? 's' : ''}?
                This action <span className="text-red-400 font-bold uppercase underline decoration-2 underline-offset-4">cannot be undone</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
              <button
                onClick={async () => {
                  const { ids } = deleteConfirmModal;
                  setDeleteConfirmModal(null);
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_URL}/api/backups/delete-bulk`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids })
                    });
                    if (!res.ok) throw new Error('Bulk delete failed');
                    setSelectedBackups(new Set());
                    fetchBackups(activeTab === 'archive' ? 'archived' : 'active');
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-4 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {cancelConfirmModal && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#050505] max-w-md w-full p-8 border border-red-500/30 space-y-6 rounded-[2.5rem]">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Abort Operation</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Stop the current background task? Partial data may remain in the temporary directory.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setCancelConfirmModal(null)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Continue
              </button>
              <button
                onClick={async () => {
                  const { ids } = cancelConfirmModal;
                  setCancelConfirmModal(null);
                  if (ids.length === 0) {
                    await cancelBackup();
                  } else if (ids.length === 1) {
                    await fetch(`${API_URL}/api/operations/${ids[0]}`, { method: 'DELETE' });
                    // Selection update handled in parent
                  } else {
                    await fetch(`${API_URL}/api/operations/cancel-bulk`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids })
                    });
                    setSelectedOps(new Set());
                  }
                }}
                className="px-4 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
              >
                Terminate Now
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {restoreModal.open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card-static max-w-md w-full p-8 space-y-6 shadow-2xl border-orange-500/30">
            <div className="flex items-center gap-3 text-orange-400">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-xl font-bold">Confirm Rollback</h2>
            </div>

            <p className="text-sm text-white/60 leading-relaxed">
              You are about to restore the suite state to <span className="text-white font-mono">{restoreModal.releaseId}</span>.
              This will <span className="text-orange-400 font-bold uppercase">overwrite</span> all current live data for the selected apps.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/10">
                <p className="text-[10px] text-orange-400/70 leading-relaxed uppercase tracking-widest font-bold mb-2">Safety Check</p>
                <p className="text-xs text-white/40 mb-3">Type <span className="text-white font-bold">RESTORE</span> below to proceed.</p>
                <input
                  type="text"
                  value={confirmString}
                  onChange={(e) => setConfirmString(e.target.value.toUpperCase())}
                  placeholder="RESTORE"
                  className="w-full bg-black/40 border-white/10 rounded-lg text-sm text-white focus:ring-orange-500/50 focus:border-orange-500/50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRestoreModal({ open: false, releaseId: null, cloudPath: null })}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={confirmString !== 'RESTORE'}
                  className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-all ${confirmString === 'RESTORE'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                    }`}
                >
                  Initiate Restore
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {routineDeleteModal && routineDeleteModal.open && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-card-static max-w-md w-full p-8 border-red-500/30 bg-red-500/5 space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Delete Routine</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Are you sure you want to permanently delete <span className="text-white font-bold">{routineDeleteModal.ids.length}</span> automated routine{routineDeleteModal.ids.length > 1 ? 's' : ''}?
                This will stop all future scheduled backups for {routineDeleteModal.ids.length > 1 ? 'these routines' : 'this routine'}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setRoutineDeleteModal(null)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
              <button
                onClick={async () => {
                  const { ids } = routineDeleteModal;
                  setRoutineDeleteModal(null);
                  setLoading(true);
                  try {
                    for (const id of ids) {
                      await fetch(`${API_URL}/api/schedules/${id}`, { method: 'DELETE' });
                    }
                    setSelectedRoutines(new Set());
                    fetchSchedules();
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-4 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {migrationResult && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#050505] w-full max-w-lg flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border border-green-500/30 rounded-3xl relative overflow-hidden animate-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/50 via-green-500 to-green-500/50 z-20" />
            
            <div className="p-8 pb-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto border border-green-500/20">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Promotion Complete</h2>
                <p className="text-[10px] text-green-400/60 font-bold uppercase tracking-[0.2em]">Environment Synchronized</p>
              </div>
            </div>

            <div className="px-8 pb-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Target Workspace</p>
                  <p className="text-sm font-bold text-white truncate">{migrationResult.targetWorkspace}</p>
                  <p className="text-[8px] font-mono text-white/40">{migrationResult.targetProject}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Operational Stats</p>
                  <p className="text-sm font-bold text-white">{migrationResult.appCount} Apps Migrated</p>
                  <p className="text-[8px] font-mono text-white/40">Duration: {(migrationResult.durationMs / 1000).toFixed(1)}s</p>
                </div>
              </div>

              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Source Archive</p>
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[7px] font-bold uppercase tracking-widest">GCS Immutable</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-white/90 truncate">{migrationResult.backupPath?.split('/').pop()}</p>
                    <p className="text-[8px] text-white/30 truncate">{migrationResult.backupPath}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setMigrationResult(null)}
                className="w-full h-12 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-400 transition-all shadow-xl shadow-green-500/20 active:scale-[0.98]"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default BackupModals;
