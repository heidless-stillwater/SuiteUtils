import React, { useMemo } from 'react';
import { 
  Cloud, 
  Archive, 
  Search, 
  ChevronDown, 
  Check, 
  Zap, 
  Trash2, 
  Database, 
  Download, 
  RefreshCw, 
  ArrowUpRight, 
  ShieldCheck, 
  AlertTriangle, 
  Minus,
  FolderOpen,
  History,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import type { BackupFile } from '../../types/backup';

interface BackupRegistryProps {
  activeTab: 'registry' | 'archive';
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sortBy: 'created' | 'updated' | 'name' | 'size';
  setSortBy: (v: 'created' | 'updated' | 'name' | 'size') => void;
  showSortMenu: boolean;
  setShowSortMenu: (v: boolean) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (v: 'asc' | 'desc') => void;
  selectedBackups: Set<string>;
  setSelectedBackups: (v: Set<string>) => void;
  backups: BackupFile[];
  openMigrateModal: (paths: string | string[]) => void;
  setDeleteConfirmModal: (v: any) => void;
  loading: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  setRestoreModal: (v: any) => void;
  handleArchive: (id: string) => void;
  handleUnarchive: (id: string) => void;
  isViewer: boolean;
  currentSuite: any;
  selectedApps: string[];
  setSelectedApps: (v: string[]) => void;
  includeStorage: boolean;
  setIncludeStorage: (v: boolean) => void;
  error: string | null;
  running: boolean;
  sortMenuRef: React.RefObject<HTMLDivElement | null>;
  scopeSelectorCollapsed: boolean;
  setScopeSelectorCollapsed: (v: boolean) => void;
}

const BackupRegistry: React.FC<BackupRegistryProps> = ({
  activeTab,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  showSortMenu,
  setShowSortMenu,
  sortOrder,
  setSortOrder,
  selectedBackups,
  setSelectedBackups,
  backups,
  openMigrateModal,
  setDeleteConfirmModal,
  loading,
  expandedId,
  setExpandedId,
  setRestoreModal,
  handleArchive,
  handleUnarchive,
  isViewer,
  currentSuite,
  selectedApps,
  setSelectedApps,
  includeStorage,
  setIncludeStorage,
  error,
  running,
  sortMenuRef,
  scopeSelectorCollapsed,
  setScopeSelectorCollapsed
}) => {

  const formatSize = (bytes?: string | number) => {
    if (!bytes) return '0 B';
    const b = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (isNaN(b)) return bytes.toString();
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = b;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const filteredBackups = useMemo(() => {
    return backups.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.id && f.id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [backups, searchQuery]);

  const sortedBackups = useMemo(() => {
    return [...filteredBackups].sort((a, b) => {
      let valA: any, valB: any;
      
      if (sortBy === 'created') {
        valA = a.timestamp || a.createdTime || 0;
        valB = b.timestamp || b.createdTime || 0;
      } else if (sortBy === 'updated') {
        valA = a.modifiedTime || 0;
        valB = b.modifiedTime || 0;
      } else if (sortBy === 'size') {
        valA = a.stats?.totalSize || parseInt(a.size || '0');
        valB = b.stats?.totalSize || parseInt(b.size || '0');
      } else {
        valA = a.name;
        valB = b.name;
      }

      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [filteredBackups, sortBy, sortOrder]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {/* Left Column: List of Backups */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card-static p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === 'registry' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                {activeTab === 'registry' ? <Cloud className="w-5 h-5 text-primary" /> : <Archive className="w-5 h-5 text-amber-400" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{activeTab === 'registry' ? 'Cloud Explorer' : 'Archive Explorer'}</h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{activeTab === 'registry' ? 'GCS Staging Bucket' : 'Long-term Storage'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  placeholder="Search backups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border-white/10 rounded-xl py-1.5 pl-10 pr-4 text-xs text-white focus:ring-primary/50 w-full md:w-48"
                />
              </div>

              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="bg-black/80 border border-white/10 hover:border-white/20 rounded-xl py-1.5 px-3 text-[10px] text-white/70 font-bold uppercase tracking-wider focus:ring-primary/40 flex items-center gap-2 transition-all shadow-xl min-w-[100px]"
                >
                  <span>{sortBy}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>

                {showSortMenu && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
                    {(['created', 'updated', 'name', 'size'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setSortBy(option);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-white/5 ${sortBy === option ? 'text-primary bg-primary/5' : 'text-white/40'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors"
                title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
              >
                {sortOrder === 'asc' ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 mb-4">
            <button
              onClick={() => {
                if (selectedBackups.size === sortedBackups.length) setSelectedBackups(new Set());
                else setSelectedBackups(new Set(sortedBackups.map(b => b.id)));
              }}
              className="text-[10px] text-white/40 hover:text-white font-bold uppercase tracking-widest flex items-center gap-2 transition-colors group"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedBackups.size === sortedBackups.length ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-white/40'}`}>
                {selectedBackups.size === sortedBackups.length && <Check className="w-3 h-3 text-white" />}
              </div>
              {selectedBackups.size === sortedBackups.length ? 'Deselect All' : 'Select All Filtered'}
            </button>
            {selectedBackups.size > 0 && (
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest animate-in fade-in slide-in-from-right-2 duration-300">
                {selectedBackups.size} Selected
              </span>
            )}
          </div>

          {/* Bulk Action for Explorer (Moved to Top) */}
          {selectedBackups.size > 0 && (
            <div className="mb-6 flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{selectedBackups.size} Selected</span>
                <button
                  onClick={() => {
                    if (selectedBackups.size === sortedBackups.length) setSelectedBackups(new Set());
                    else setSelectedBackups(new Set(sortedBackups.map(b => b.id)));
                  }}
                  className="text-[10px] text-red-400/60 hover:text-red-400 font-bold uppercase tracking-widest underline underline-offset-4"
                >
                  {selectedBackups.size === sortedBackups.length ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const paths = Array.from(selectedBackups).map(id => {
                      const b = backups.find(back => back.id === id);
                      return b?.fullPath || '';
                    }).filter(p => !!p);
                    openMigrateModal(paths);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Migrate Selected
                </button>
                <button
                  onClick={() => setDeleteConfirmModal({ open: true, ids: Array.from(selectedBackups) })}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {loading && backups.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card-static p-6 animate-pulse bg-white/5 h-24" />
              ))
            ) : sortedBackups.length > 0 ? (
              sortedBackups.map((backup) => (
                <div
                  key={backup.id}
                  className={`glass-card-static overflow-hidden transition-all duration-300 ${expandedId === backup.id ? 'ring-1 ring-primary/40 bg-primary/5' : 'hover:border-primary/30 group'}`}
                >
                  <div
                    className="p-4 cursor-pointer flex items-center gap-4"
                    onClick={() => setExpandedId(expandedId === backup.id ? null : backup.id)}
                  >
                    <div className="flex items-center gap-4 pr-1">
                      <input
                        type="checkbox"
                        checked={selectedBackups.has(backup.id)}
                        onChange={(e) => {
                          const next = new Set(selectedBackups);
                          if (e.target.checked) next.add(backup.id);
                          else next.delete(backup.id);
                          setSelectedBackups(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded-full border-white/20 bg-white/5 text-primary focus:ring-primary/50 relative z-20 cursor-pointer"
                      />
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${expandedId === backup.id ? 'bg-primary text-white' : (activeTab === 'archive' ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary')}`}>
                        {activeTab === 'archive' ? <Archive className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white/90 truncate">{backup.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                          Created: {
                            (backup.timestamp || backup.createdTime)
                              ? format(new Date(backup.timestamp || backup.createdTime!), 'MMM dd, HH:mm')
                              : 'N/A'
                          }
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ${
                              backup.type === 'full' 
                                ? (backup.storageStatus === 'failed' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary') : 
                              backup.type === 'database' ? 'bg-green-500/10 text-green-400' : 
                              'bg-blue-500/10 text-blue-400'
                            }`}>
                              {backup.type === 'full' 
                                ? (backup.storageStatus === 'failed' ? 'Partial (Storage Failed)' : 
                                   backup.storageStatus === 'success' ? 'Full Snapshot' : 'Complete') : 
                               backup.type === 'database' ? 'DB Only' : 
                               backup.type === 'storage' ? 'Assets Only' : 'Legacy'}
                            </span>
                            {backup.apps && backup.apps.length >= 7 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/10 text-white/40 uppercase tracking-tighter border border-white/5">
                                Full Suite
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-white/30 font-mono flex items-center gap-1">
                            <Database className="w-3 h-3 opacity-30" />
                            {formatSize(backup.stats?.totalSize?.toString() || backup.size)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 transition-opacity ${expandedId === backup.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRestoreModal({
                              open: true,
                              releaseId: backup.name.replace('.zip', ''),
                              cloudPath: backup.fullPath || null
                            });
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-orange-500/20 text-white/40 hover:text-orange-400 transition-colors"
                          title="Restore this version"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMigrateModal(backup.fullPath || '');
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 text-white/40 hover:text-primary transition-colors"
                          title="Migrate to another suite"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 text-white/40 hover:text-primary transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {!isViewer && (
                          activeTab === 'registry' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArchive(backup.id); }}
                              className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 text-white/40 hover:text-amber-400 transition-colors"
                              title="Move to Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnarchive(backup.id); }}
                              className="p-2 rounded-lg bg-white/5 hover:bg-green-500/20 text-white/40 hover:text-green-400 transition-colors"
                              title="Restore to Registry"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          )
                        )}
                        {!isViewer && (
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setDeleteConfirmModal({ open: true, ids: [backup.id] }); 
                            }}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/20 transition-transform duration-300 ${expandedId === backup.id ? 'rotate-180 text-primary' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Section */}
                  {expandedId === backup.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Backup Identity</p>
                            <p className="text-[10px] font-mono text-white/60 break-all bg-black/40 p-2 rounded-lg border border-white/5">
                              {backup.id}
                            </p>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Source Scope</p>
                              <p className="text-[10px] text-white/80 font-bold">{backup.scope || (backup.name.split('_')[0] === 'Manual' ? 'Manual Run' : 'Scheduled')}</p>
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Type</p>
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                backup.type === 'full' && backup.storageStatus === 'failed' ? 'text-amber-500' : 'text-primary'
                              }`}>
                                {backup.type === 'full' 
                                  ? (backup.storageStatus === 'failed' ? 'Partial Snapshot' : 
                                     backup.storageStatus === 'success' ? 'Full (DB + Assets)' : 'Complete Snapshot') : 
                                 backup.type === 'database' ? 'Database Snapshot' : 
                                 backup.type === 'storage' ? 'Storage Assets Only' : 'Legacy Snapshot'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Asset Integrity</p>
                              <div className="flex items-center gap-2">
                                {backup.storageStatus === 'success' ? (
                                  <>
                                    <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-tighter">Synchronized</span>
                                  </>
                                ) : backup.storageStatus === 'failed' ? (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">Asset Sync Failed</span>
                                  </>
                                ) : (
                                  <>
                                    <Minus className="w-3.5 h-3.5 text-white/20" />
                                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">No Assets</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Contents</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(backup.apps || []).map(appId => (
                                <span key={appId} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[9px] font-bold border border-primary/10 capitalize">
                                  {appId}
                                </span>
                              ))}
                              {(backup.type === 'full' || backup.type === 'database' || backup.isLegacy) && (
                                <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-[9px] font-bold border border-green-500/10">Firestore DB</span>
                              )}
                              {(backup.includeStorage || backup.type === 'storage' || backup.isLegacy) && (
                                <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-bold border border-blue-500/10">Cloud Storage</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Integrity Checksum</p>
                            <p className="text-[9px] font-mono text-white/30 truncate italic">{backup.checksum || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="glass-card-static p-12 flex flex-col items-center justify-center text-center">
                <FolderOpen className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-white/40 text-sm">No snapshots found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Active Progress / Stats */}
      <div className="space-y-6">
        {/* Stats Card */}
        <div className="glass-card-static p-6">
          <h3 className="text-sm font-bold text-white/90 mb-4">Snapshot Integrity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-xs text-white/60">Registry Sync</span>
              </div>
              <span className="text-xs font-mono text-green-400">PASSED</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-xs text-white/60">Apps Tracked</span>
              </div>
              <span className="text-xs font-mono text-white/80">7/7</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/20">
                <History className="w-4 h-4" />
                <span className="text-xs">Last Global Run</span>
              </div>
              <span className="text-xs font-mono text-white/40">Never</span>
            </div>
          </div>

          <div className="mt-6 p-3 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-[10px] text-primary/70 leading-relaxed italic">
              "Snapshots include full JSON exports of Firestore and recursive downloads of the Storage container."
            </p>
          </div>
        </div>

        {/* App Selection - Hidden during active operations to focus on progress */}
        {!running && (
          <div className="glass-card-static p-6 overflow-hidden">
            <div 
              className="flex items-center justify-between cursor-pointer group mb-2"
              onClick={() => setScopeSelectorCollapsed(!scopeSelectorCollapsed)}
            >
              <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Scope Selection
              </h3>
              <div className={`p-1 rounded-md hover:bg-white/5 transition-all ${!scopeSelectorCollapsed ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4 text-white/20" />
              </div>
            </div>

            {!scopeSelectorCollapsed && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-4 mt-4">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Target Apps</span>
                  {currentSuite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const allIds = Object.keys(currentSuite.apps);
                        if (selectedApps.length === allIds.length) {
                          setSelectedApps([]);
                        } else {
                          setSelectedApps(allIds);
                        }
                      }}
                      className="text-[10px] uppercase tracking-wider text-primary hover:text-primary/70 font-bold transition-colors"
                    >
                      {selectedApps.length === Object.keys(currentSuite.apps).length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {currentSuite && Object.entries(currentSuite.apps).map(([id, app]: [string, any]) => (
                    <label key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedApps.includes(id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApps([...selectedApps, id]);
                          } else {
                            setSelectedApps(selectedApps.filter(a => a !== id));
                          }
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                      />
                      <span className="text-xs text-white/60">{app.displayName}</span>
                    </label>
                  ))}
                  {(!currentSuite || Object.keys(currentSuite.apps).length === 0) && (
                    <p className="text-[10px] text-white/20 italic">No apps found in current suite.</p>
                  )}
                </div>
              </div>
            )}

            {/* Global Assets Toggle - Always visible or only when expanded? Let's make it always visible but separated */}
            <div className={`mt-6 pt-4 border-t border-white/5 space-y-3 transition-all ${scopeSelectorCollapsed ? 'mt-2' : ''}`}>
              <h4 className="text-[10px] uppercase tracking-wider text-white/20 font-bold">Global Assets</h4>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${includeStorage ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'}`}>
                    <Cloud className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">Include Storage Bucket</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeStorage}
                  onChange={(e) => setIncludeStorage(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                />
              </label>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="glass-card-static p-4 border-red-500/20 bg-red-500/5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs text-red-400 font-bold">Operation Failed</p>
              <p className="text-[11px] text-red-400/70 mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRegistry;
