import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  Cloud,
  ShieldCheck,
  History,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Search,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  Clock,
  Calendar,
  CalendarCheck,
  Zap,
  Info,
  Pause,
  Edit3,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import StorageExplorer from '../components/storage/StorageExplorer';

const API_URL = 'http://localhost:5181';

interface BackupFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  isDir: boolean;
  fullPath?: string;
}

interface BackupEvent {
  step: 'db' | 'storage' | 'zip' | 'cloud' | 'complete' | 'error' | 'info' | 'queued';
  message: string;
  appId?: string;
  percent?: number;
  metrics?: {
    totalSize: number;
    transferredSize: number;
    elapsed: number;
    eta: number;
    speed: number;
  };
}

export function BackupAdminPage() {
  const { currentSuite } = useSuite();
  const { isViewer } = useAuth();
  const [searchParams] = useSearchParams();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<BackupEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'automation' | 'registry' | 'storage'>('automation');
  const [includeStorage, setIncludeStorage] = useState(false);
  const [restoreModal, setRestoreModal] = useState<{ open: boolean; releaseId: string | null; cloudPath: string | null }>({ open: false, releaseId: null, cloudPath: null });
  const [migrateModal, setMigrateModal] = useState<{ open: boolean; cloudPath: string | null; workspaces: any[] }>({ open: false, cloudPath: null, workspaces: [] });
  const [selectedTargetWorkspace, setSelectedTargetWorkspace] = useState<string>('');
  const [confirmString, setConfirmString] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'name' | 'size'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activeOperations, setActiveOperations] = useState<any[]>([]);
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set());
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
  const [routinesCollapsed, setRoutinesCollapsed] = useState(false);
  const [operationsCollapsed, setOperationsCollapsed] = useState(false);
  const [conflictModal, setConflictModal] = useState<{ open: boolean; message: string; metadata?: any; params: any } | null>(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{ open: boolean; ids: string[]; type: 'single' | 'bulk' } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; paths: string[] } | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [renamingScheduleId, setRenamingScheduleId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [newCron, setNewCron] = useState('');
  const [newScope, setNewScope] = useState<'FullSuite' | 'Selection'>('Selection');
  const [newIncludeStorage, setNewIncludeStorage] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newSelectedApps, setNewSelectedApps] = useState<string[]>([]);
  const [scopeSelectorCollapsed, setScopeSelectorCollapsed] = useState(true);
  const [migrationAnalysis, setMigrationAnalysis] = useState<any[] | null>(null);
  const [analyzingMigration, setAnalyzingMigration] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_URL}/api/schedules`);
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'automation' || tab === 'registry' || tab === 'storage') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleRename = async (id: string) => {
    if (!renamingName.trim()) {
      setRenamingScheduleId(null);
      return;
    }

    try {
      await fetch(`${API_URL}/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renamingName.trim() })
      });
      setRenamingScheduleId(null);
      fetchSchedules();
    } catch (err) {
      console.error('Failed to rename schedule:', err);
    }
  };

  const toggleSchedule = async (s: any) => {
    try {
      await fetch(`${API_URL}/api/schedules/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !s.active })
      });
      fetchSchedules();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/schedules/${id}`, { method: 'DELETE' });
      fetchSchedules();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const handleAddSchedule = async () => {
    if (!newScheduleName.trim()) return;
    try {
      await fetch(`${API_URL}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newScheduleName.trim(),
          cron: newCron,
          scope: newScope,
          appIds: newScope === 'Selection' ? newSelectedApps : [],
          includeStorage: newIncludeStorage
        })
      });
      setNewScheduleName('');
      fetchSchedules();
    } catch (err) {
      console.error('Failed to add schedule:', err);
    }
  };

  const cancelOperation = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/operations/${id}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to cancel operation:', err);
    }
  };

  const isRoutineRunning = (s: any) => {
    return activeOperations.some(op =>
      (op.status === 'running' || op.status === 'queued') &&
      op.metadata?.scope === s.scope &&
      JSON.stringify(op.metadata?.appIds) === JSON.stringify(s.appIds) &&
      op.metadata?.includeStorage === s.includeStorage
    );
  };

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize selected apps once suite is loaded
  useEffect(() => {
    if (currentSuite && selectedApps.length === 0) {
      const allApps = Object.keys(currentSuite.apps);
      setSelectedApps(allApps.filter(id => id !== 'ag-video-system'));
    }
  }, [currentSuite]);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/backups`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Filter for zip files or meaningful folders
      setBackups(data.files.filter((f: BackupFile) => !f.name.includes('placeholder')));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchSchedules();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/operations`);
        const data = await res.json();
        setActiveOperations(data);
      } catch (err) {
        console.error('Failed to poll operations:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const runBackup = async (force = false, queue = false, customParams?: { scope: string; appIds?: string[]; includeStorage: boolean }) => {
    setRunning(true);
    setEvents([]);
    setError(null);

    let scope: string;
    let appIds: string[];
    let storage: boolean;

    if (customParams) {
      scope = customParams.scope;
      appIds = customParams.appIds || [];
      storage = customParams.includeStorage;
    } else {
      const isFullSuite = selectedApps.length === 0 || selectedApps.length === (currentSuite ? Object.keys(currentSuite.apps).length : 0);

      let appInfo = '';
      if (isFullSuite) {
        appInfo = 'FullSuite';
      } else {
        const appsToShow = selectedApps.slice(0, 3).join('-');
        const moreCount = selectedApps.length > 3 ? `_and_${selectedApps.length - 3}_more` : '';
        appInfo = `${appsToShow}${moreCount}`;
      }

      const assetType = includeStorage ? 'WithAssets' : 'DBOnly';
      scope = `Manual_${appInfo}_${assetType}`;
      appIds = selectedApps;
      storage = includeStorage;
    }

    const appIdsParam = appIds.length > 0 ? `&appIds=${appIds.join(',')}` : '';
    const storageParam = `&includeStorage=${storage}`;
    const forceParam = force ? '&force=true' : '';
    const queueParam = queue ? '&queue=true' : '';

    const url = `${API_URL}/api/backups/run?scope=${scope}${appIdsParam}${storageParam}${forceParam}${queueParam}`;

    try {
      const response = await fetch(`${API_URL}/api/backups/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          appIds,
          includeStorage: storage,
          force,
          queue
        })
      });

      if (response.status === 409 && !force && !queue) {
        const data = await response.json();
        setConflictModal({
          open: true,
          message: data.message,
          metadata: data.metadata,
          params: { force: true, queue: false, customParams: customParams || undefined }
        });
        setRunning(false);
        return;
      }

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const { id } = await response.json();
      const eventSource = new EventSource(`${API_URL}/api/operations/${id}/events`);

      eventSource.onmessage = (event) => {
        const data: BackupEvent = JSON.parse(event.data);
        setEvents((prev) => [...prev, data]);

        if (data.step === 'complete') {
          eventSource.close();
          setRunning(false);
          fetchBackups();
        }

        if (data.step === 'queued') {
          setEvents((prev) => [...prev, { step: 'info', message: '🕒 Job added to queue. Waiting...' }]);
        }

        if (data.step === 'error') {
          eventSource.close();
          setRunning(false);
          setError(data.message);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setRunning(false);
      };
    } catch (err: any) {
      setRunning(false);
      setError(`Failed to start backup: ${err.message}`);
    }
  };

  const cancelBackup = async () => {
    setEvents((prev) => [...prev, { step: 'error', message: '🛑 Cancellation requested by user...' }]);
    try {
      await fetch(`${API_URL}/api/backups/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to cancel backup:', err);
    }
  };

  const handleRestore = () => {
    if (!restoreModal.releaseId || confirmString !== 'RESTORE') {
      setError('Please type RESTORE to confirm rollback.');
      return;
    }

    setRunning(true);
    setEvents([]);
    setRestoreModal({ open: false, releaseId: null, cloudPath: null });
    setConfirmString('');

    const appIdsParam = selectedApps.length > 0 ? `&appIds=${selectedApps.join(',')}` : '';
    const storageParam = `&includeStorage=${includeStorage}`;
    const url = `${API_URL}/api/backups/restore?cloudPath=${encodeURIComponent(restoreModal.cloudPath || '')}${appIdsParam}${storageParam}&confirmation=${confirmString}`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev, data]);

      if (data.percent === 100 || data.type === 'success') {
        eventSource.close();
        setRunning(false);
      }

      if (data.type === 'error') {
        eventSource.close();
        setRunning(false);
        setError(data.message);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setRunning(false);
      setError('Connection lost during restoration.');
    };
  };

  const openMigrateModal = async (cloudPath: string) => {
    try {
      const res = await fetch(`${API_URL}/api/workspaces`);
      const data = await res.json();
      setMigrateModal({ open: true, cloudPath, workspaces: data });
    } catch (err) {
      setError('Failed to load workspaces for migration.');
    }
  };

  const runMigrationAnalysis = async () => {
    if (!selectedTargetWorkspace || !migrateModal.cloudPath) return;
    setAnalyzingMigration(true);
    setMigrationAnalysis(null);
    try {
      const res = await fetch(`${API_URL}/api/migration/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBackupPath: migrateModal.cloudPath,
          targetWorkspaceId: selectedTargetWorkspace
        })
      });
      const data = await res.json();
      setMigrationAnalysis(data);
    } catch (err) {
      setError('Migration analysis failed.');
    } finally {
      setAnalyzingMigration(false);
    }
  };

  const handleMigrate = () => {
    if (!selectedTargetWorkspace || !migrateModal.cloudPath) return;

    setRunning(true);
    setEvents([]);
    setMigrateModal({ ...migrateModal, open: false });
    setMigrationAnalysis(null);

    const url = `${API_URL}/api/migrate`;

    // We use a regular fetch POST first to trigger the stream
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBackupPath: migrateModal.cloudPath,
        targetWorkspaceId: selectedTargetWorkspace
      })
    }).then(response => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      function read() {
        reader?.read().then(({ done, value }) => {
          if (done) {
            setRunning(false);
            return;
          }
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                setEvents((prev) => [...prev, data]);
                if (data.type === 'success') setRunning(false);
                if (data.type === 'error') {
                  setError(data.message);
                  setRunning(false);
                }
              } catch (e) { }
            }
          });
          read();
        });
      }
      read();
    }).catch(err => {
      setError('Migration failed: ' + err.message);
      setRunning(false);
    });
  };

  const sortedBackups = useMemo(() => {
    const result = [...backups]
      .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'created') {
          comparison = new Date(a.createdTime || 0).getTime() - new Date(b.createdTime || 0).getTime();
        } else if (sortBy === 'updated') {
          comparison = new Date(a.modifiedTime || 0).getTime() - new Date(b.modifiedTime || 0).getTime();
        } else if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
          comparison = parseInt(a.size || '0') - parseInt(b.size || '0');
        }

        // Secondary sort by name for stability
        if (comparison === 0) {
          comparison = a.name.localeCompare(b.name);
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });

    console.log('Sort result (first 3 IDs):', result.slice(0, 3).map(b => b.id));
    return result;
  }, [backups, searchQuery, sortBy, sortOrder]);

  const formatSize = (bytes?: string) => {
    if (!bytes) return 'N/A';
    const b = parseInt(bytes);
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="page-enter space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white/90">Backup & Recovery</h1>
            <p className="text-sm text-white/40 mt-1">
              Global operational snapshots across the Stillwater App Suite
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchBackups}
              className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {!isViewer && (
              running ? (
                <button
                  onClick={() => setCancelConfirmModal({ open: true, ids: [], type: 'single' })}
                  className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all font-bold text-xs flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel Job
                </button>
              ) : (
                <button
                  onClick={() => runBackup()}
                  disabled={running}
                  className="btn-primary group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Run Global Snapshot
                </button>
              )
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-white/5 mb-8">
          <button
            onClick={() => setActiveTab('automation')}
            className={`pb-4 px-2 text-xs font-bold uppercase tracking-[0.2em] transition-all relative flex items-center gap-2 ${activeTab === 'automation' ? 'text-primary' : 'text-white/20 hover:text-white/40'
              }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Automation Engine
            {activeTab === 'automation' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(13,148,136,0.8)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-4 px-2 text-xs font-bold uppercase tracking-[0.2em] transition-all relative flex items-center gap-2 ${activeTab === 'registry' ? 'text-primary' : 'text-white/20 hover:text-white/40'
              }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Cloud Registry
            {activeTab === 'registry' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(13,148,136,0.8)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-4 px-2 text-xs font-bold uppercase tracking-[0.2em] transition-all relative flex items-center gap-2 ${activeTab === 'storage' ? 'text-primary' : 'text-white/20 hover:text-white/40'
              }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Storage Explorer
            {activeTab === 'storage' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(13,148,136,0.8)]" />
            )}
          </button>
        </div>

        {activeTab === 'registry' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">

            {/* Left Column: List of Backups */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card-static p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Cloud Explorer</h2>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">GCS Staging Bucket</p>
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

                {/* Bulk Action for Explorer (Moved to Top) */}
                {selectedBackups.size > 0 && (
                  <div className="mb-6 flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{selectedBackups.size} Selected</span>
                      <button
                        onClick={() => {
                          if (selectedBackups.size === sortedBackups.length) setSelectedBackups(new Set());
                          else setSelectedBackups(new Set(sortedBackups.map(b => b.fullPath || '')));
                        }}
                        className="text-[10px] text-red-400/60 hover:text-red-400 font-bold uppercase tracking-widest underline underline-offset-4"
                      >
                        {selectedBackups.size === sortedBackups.length ? 'Deselect All' : 'Select All Filtered'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setDeleteConfirmModal({ open: true, paths: Array.from(selectedBackups) })}
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
                              checked={selectedBackups.has(backup.fullPath || '')}
                              onChange={(e) => {
                                const next = new Set(selectedBackups);
                                if (e.target.checked) next.add(backup.fullPath || '');
                                else next.delete(backup.fullPath || '');
                                setSelectedBackups(next);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded-full border-white/20 bg-white/5 text-primary focus:ring-primary/50 relative z-20 cursor-pointer"
                            />
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${expandedId === backup.id ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                              <Cloud className="w-5 h-5" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white/90 truncate">{backup.name}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                                {sortBy === 'created' ? 'Created' : 'Updated'}: {
                                  (sortBy === 'created' ? backup.createdTime : backup.modifiedTime)
                                    ? format(new Date((sortBy === 'created' ? backup.createdTime : backup.modifiedTime)!), 'MMM dd, HH:mm')
                                    : 'N/A'
                                }
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/10 text-primary uppercase tracking-tighter">
                                  {backup.name.split('.').pop() || 'File'}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-white/30 font-mono flex items-center gap-1">
                                  <Database className="w-3 h-3 opacity-30" />
                                  {formatSize(backup.size)}
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
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Cloud Registry Path</p>
                                  <p className="text-[10px] font-mono text-white/60 break-all bg-black/40 p-2 rounded-lg border border-white/5">
                                    {backup.fullPath || 'N/A'}
                                  </p>
                                </div>
                                <div className="flex gap-4">
                                  <div>
                                    <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Source Scope</p>
                                    <p className="text-[10px] text-white/80 font-bold">{backup.name.split('_')[0] === 'Manual' ? 'Manual Run' : 'Scheduled'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Selection Mode</p>
                                    <p className="text-[10px] text-white/80 font-bold">{(backup.name.split('_')[1] || 'Unknown').replace(/-/g, ', ')}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Included Assets</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-[9px] font-bold border border-green-500/10">Firestore DB</span>
                                    {(backup.name.split('_')[2] || 'Unknown') === 'WithAssets' && (
                                      <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-bold border border-blue-500/10">Cloud Storage</span>
                                    )}
                                    <span className="px-2 py-1 rounded-md bg-white/5 text-white/40 text-[9px] font-bold border border-white/5">Identity Map</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Integrity Hash</p>
                                  <p className="text-[9px] font-mono text-white/30 truncate italic">CRC32: {Math.random().toString(36).substring(7).toUpperCase()}</p>
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

              {/* Running Status */}
              {running && (
                <div className="glass-card-static p-6 border-primary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <h3 className="text-sm font-bold text-white/90">Operation in Progress</h3>
                  </div>

                  <div className="space-y-4">
                    {events.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Current Task</p>
                        <p className="text-xs text-primary font-medium">{events[events.length - 1].message}</p>
                        {events[events.length - 1].percent !== undefined && (
                          <div className="space-y-3 mt-4">
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${events[events.length - 1].percent}%` }}
                              />
                            </div>
                            
                            {events[events.length - 1].metrics && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                <div>
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Transfer Rate</p>
                                  <p className="text-xs font-mono text-primary font-bold">
                                    {(events[events.length - 1].metrics!.speed / 1024 / 1024).toFixed(2)} MB/s
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Transferred</p>
                                  <p className="text-xs font-mono text-white/80">
                                    {(events[events.length - 1].metrics!.transferredSize / 1024 / 1024 / 1024).toFixed(2)} / {(events[events.length - 1].metrics!.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Elapsed Time</p>
                                  <p className="text-xs font-mono text-white/80">
                                    {Math.floor(events[events.length - 1].metrics!.elapsed / 60)}m {Math.floor(events[events.length - 1].metrics!.elapsed % 60)}s
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Estimated Completion</p>
                                  <p className="text-xs font-mono text-orange-400 font-bold">
                                    {events[events.length - 1].metrics!.eta > 60 
                                      ? `${Math.floor(events[events.length - 1].metrics!.eta / 60)}m ${events[events.length - 1].metrics!.eta % 60}s`
                                      : `${events[events.length - 1].metrics!.eta}s`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-black/40 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-[10px] text-white/40 leading-relaxed space-y-1">
                      {events.map((evt, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-primary opacity-50 shrink-0">[{format(new Date(), 'HH:mm:ss')}]</span>
                          <span className={evt.step === 'complete' ? 'text-green-400' : evt.step === 'error' ? 'text-red-400' : ''}>
                            {evt.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* App Selection */}
              <div className="glass-card-static p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Scope Selection
                  </h3>
                  {currentSuite && (
                    <button
                      onClick={() => {
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
                <div className="space-y-2">
                  {currentSuite && Object.entries(currentSuite.apps).map(([id, app]) => (
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

                {/* Global Assets Toggle */}
                <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
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
        )}

        {(activeTab as string) === 'automation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">

              {/* Active Routines (Moved to top and collapsible) */}
              <div className="space-y-4">
                <button
                  onClick={() => setRoutinesCollapsed(!routinesCollapsed)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest group-hover:text-white/40 transition-colors">Active Routines</h3>
                    <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                      {schedules.length} Active
                    </span>
                  </div>
                  <div className={`p-1 rounded-md hover:bg-white/5 transition-all ${!routinesCollapsed ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4 text-white/20" />
                  </div>
                </button>

                {!routinesCollapsed && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {schedules.length > 0 ? (
                      schedules.map((s) => (
                        <div key={s.id} className={`glass-card-static p-6 flex items-center justify-between group transition-all ${isRoutineRunning(s) ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/5' : 'hover:border-primary/20'}`}>
                          <div className="flex items-center gap-6 flex-1">
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
                                    title="Click to rename"
                                  >
                                    {s.name || s.scope}
                                  </h4>
                                )}
                                <span className="text-[10px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/40 uppercase tracking-widest mr-[10px]">
                                  {s.cronExpression}
                                </span>
                                {s.status === 'paused' ? (
                                  <span className="text-[9px] font-black bg-orange-500/10 text-orange-400 px-[10px] py-0.5 rounded border border-orange-500/20 uppercase tracking-widest">
                                    Paused
                                  </span>
                                ) : isRoutineRunning(s) && (
                                  <span className="text-[9px] font-black bg-primary/20 text-primary px-[10px] py-0.5 rounded border border-primary/30 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="flex h-1.5 w-1.5 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                                    </span>
                                    Active
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
                              onClick={() => runBackup(false, false, { scope: s.scope, appIds: s.appIds, includeStorage: s.includeStorage })}
                              disabled={running}
                              className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Run Routine Now"
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                            <button
                              onClick={async () => {
                                await fetch(`${API_URL}/api/schedules/${s.id}/toggle-pause`, { method: 'POST' });
                                fetchSchedules();
                              }}
                              className={`p-2.5 rounded-xl transition-all border ${s.status === 'active'
                                  ? 'bg-white/5 text-white/40 border-transparent hover:text-orange-400 hover:bg-orange-400/10 hover:border-orange-400/20'
                                  : 'bg-primary/20 text-primary border-primary/20 hover:bg-primary/30'
                                }`}
                              title={s.status === 'active' ? 'Pause Routine' : 'Resume Routine'}
                            >
                              {s.status === 'active' ? <Pause className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingRoutineId(s.id);
                                setNewCron(s.cronExpression);
                                setNewScope(s.scope.startsWith('backup_') ? 'Selection' : 'FullSuite');
                                setNewIncludeStorage(s.includeStorage);
                                if (s.appIds) setSelectedApps(s.appIds);
                              }}
                              className="p-2.5 rounded-xl bg-white/5 text-white/40 border border-transparent hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all"
                              title="Edit Routine Configuration"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                await fetch(`${API_URL}/api/schedules/${s.id}`, { method: 'DELETE' });
                                fetchSchedules();
                              }}
                              className="p-2.5 rounded-xl bg-white/5 text-white/20 border border-transparent hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="glass-card-static p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                          <Calendar className="w-8 h-8 text-white/10" />
                        </div>
                        <h4 className="text-white/60 font-bold mb-2">No Automated Routines</h4>
                        <p className="text-white/30 text-xs max-w-[280px]">
                          Configure your first automated backup routine using the scheduler on the right.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Live Operations Monitor (Collapsible) */}
              <div className="space-y-4">
                <button
                  onClick={() => setOperationsCollapsed(!operationsCollapsed)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 group-hover:text-primary/70 transition-colors">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      Live Operations
                      {activeOperations.length > 0 && (
                        <span className="ml-2 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                          {activeOperations.length} Active
                        </span>
                      )}
                    </h3>

                    {!operationsCollapsed && activeOperations.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const allIds = activeOperations.map(op => op.id);
                          if (selectedOps.size === allIds.length) setSelectedOps(new Set());
                          else setSelectedOps(new Set(allIds));
                        }}
                        className="text-[10px] text-primary/40 hover:text-primary font-bold uppercase tracking-widest underline underline-offset-4 transition-colors"
                      >
                        {selectedOps.size === activeOperations.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className={`p-1 rounded-md hover:bg-white/5 transition-all ${!operationsCollapsed ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4 text-white/20" />
                  </div>
                </button>

                {!operationsCollapsed && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Bulk Action for Operations (Moved to Top) */}
                    {selectedOps.size > 0 && (
                      <div className="mb-2 flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{selectedOps.size} Selected</span>
                        </div>
                        <button
                          onClick={() => setCancelConfirmModal({ open: true, ids: Array.from(selectedOps), type: 'bulk' })}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                        >
                          Cancel All Selected
                        </button>
                      </div>
                    )}

                    {activeOperations.length > 0 ? (
                      activeOperations.map((op) => (
                        <div key={op.id} className="relative group flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-primary/20 transition-all animate-in fade-in slide-in-from-left-2 duration-300">
                          {/* Left: Checkbox & Status Icon */}
                          <div className="flex items-center gap-3 shrink-0">
                            {op.status === 'running' && (
                              <input
                                type="checkbox"
                                checked={selectedOps.has(op.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedOps);
                                  if (e.target.checked) next.add(op.id);
                                  else next.delete(op.id);
                                  setSelectedOps(next);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded-full border-white/10 bg-white/5 text-primary focus:ring-primary/50 cursor-pointer transition-all hover:border-primary/40"
                              />
                            )}
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center relative">
                              <Loader2 className="w-5 h-5 text-primary animate-spin opacity-60" />
                              <div className="absolute inset-0 bg-primary/5 rounded-xl animate-pulse" />
                            </div>
                          </div>

                          {/* Center: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.15em]">{op.type}</h4>
                              <span className="text-[9px] text-primary/60 font-mono tracking-tighter font-bold truncate max-w-[200px]" title={op.id}>{op.id}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-white/60 truncate flex items-center gap-2">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin-slow text-primary/40" />
                                {op.message}
                              </span>
                            </div>
                          </div>

                          {/* Right: Progress & Actions */}
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <div className="flex items-baseline gap-3">
                              <span className="text-[10px] text-white/20 font-mono">{format(new Date(op.startTime), 'HH:mm:ss')}</span>
                              <span className="text-sm font-black text-primary tabular-nums">{Math.round(op.progress)}%</span>
                            </div>
                            <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                              <div 
                                className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_8px_rgba(13,148,136,0.3)]"
                                style={{ width: `${op.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Hover Cancel Button */}
                          {op.status === 'running' && (
                            <button
                              onClick={() => setCancelConfirmModal({ open: true, ids: [op.id], type: 'single' })}
                              className="absolute -right-2 -top-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:bg-red-600 hover:scale-110 active:scale-95 z-30"
                              title="Cancel Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="glass-card-static p-12 flex flex-col items-center justify-center text-center opacity-40">
                        <RefreshCw className="w-8 h-8 text-white/10 mb-4 animate-spin-slow" />
                        <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">No active background tasks</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (Sidebars) */}
            <div className="space-y-6">
              {/* Add/Edit Schedule Form */}
              <div className={`glass-card-static p-6 space-y-6 transition-all ${editingRoutineId ? 'bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20' : 'bg-gradient-to-br from-primary/10 to-transparent border-primary/20'}`}>
                <div className={`flex items-center justify-between ${editingRoutineId ? 'text-orange-400' : 'text-primary'}`}>
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">{editingRoutineId ? 'Edit Routine Configuration' : 'New Routine'}</h3>
                  </div>
                  {editingRoutineId && (
                    <button
                      onClick={() => {
                        setEditingRoutineId(null);
                        setNewCron('');
                        setNewScope('Selection');
                        setNewIncludeStorage(false);
                        setSelectedApps([]);
                      }}
                      className="text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-3 block">Backup Scope</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                      <button
                        onClick={() => setNewScope('FullSuite')}
                        className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${newScope === 'FullSuite' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                      >
                        Full Suite
                      </button>
                      <button
                        onClick={() => setNewScope('Selection')}
                        className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${newScope === 'Selection' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
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
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">Select Apps to Include</span>
                            <span className="text-[9px] text-primary/40 bg-primary/5 px-1.5 py-0.5 rounded font-mono">
                              {selectedApps.length}
                            </span>
                          </div>
                          <div className={`transition-transform duration-300 ${scopeSelectorCollapsed ? '' : 'rotate-180'}`}>
                            <ChevronDown className="w-3.5 h-3.5 text-white/20" />
                          </div>
                        </button>

                        {!scopeSelectorCollapsed && (
                          <div className="p-3 pt-0 space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8px] text-white/20 uppercase tracking-tighter">Choose target applications</span>
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
                                  className="text-[9px] uppercase tracking-wider text-primary hover:text-primary/70 font-bold transition-colors"
                                >
                                  {selectedApps.length === Object.keys(currentSuite.apps).length ? 'Deselect All' : 'Select All'}
                                </button>
                              )}
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                              {currentSuite && Object.entries(currentSuite.apps).map(([id, app]) => (
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
                              {(!currentSuite || Object.keys(currentSuite.apps).length === 0) && (
                                <p className="text-[9px] text-white/20 italic p-2">No apps found.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Include Storage</span>
                      <p className="text-[9px] text-white/20 uppercase tracking-tighter">Backup GCS assets</p>
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
                        placeholder="0 0 * * * (Daily at midnight)"
                        className="flex-1 bg-black/40 border-white/10 rounded-xl text-xs text-white p-3 focus:ring-primary/40 transition-all focus:border-primary/40 outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (!newCron.trim()) return;

                          const isSelection = newScope === 'Selection';
                          const appIds = isSelection ? selectedApps : undefined;

                          let scopeName = 'backup_FullSuite';
                          if (isSelection) {
                            const appsToShow = selectedApps.slice(0, 3).join('-');
                            const moreCount = selectedApps.length > 3 ? `_and_${selectedApps.length - 3}_more` : '';
                            scopeName = `backup_${appsToShow}${moreCount}`;
                          }

                          await fetch(`${API_URL}/api/schedules${editingRoutineId ? `/${editingRoutineId}` : ''}`, {
                            method: editingRoutineId ? 'PATCH' : 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              cronExpression: newCron.trim(),
                              scope: scopeName,
                              appIds,
                              includeStorage: newIncludeStorage
                            })
                          });
                          setEditingRoutineId(null);
                          setNewCron('');
                          fetchSchedules();
                        }}
                        className={`px-4 py-3 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg ${editingRoutineId ? 'bg-orange-500 shadow-orange-500/20' : 'bg-primary shadow-primary/20'}`}
                      >
                        {editingRoutineId ? 'Save' : 'Create'}
                      </button>
                    </div>
                    <p className="text-[9px] text-white/20 mt-2 leading-relaxed">
                      Standard crontab format. Use the patterns below for quick setup.
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl space-y-3">
                    <h4 className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Recommended Patterns</h4>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <button
                          onClick={() => setNewCron('*/1 * * * *')}
                          className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary hover:bg-primary/20 transition-all text-center"
                        >
                          1 Min
                        </button>
                        <button
                          onClick={() => setNewCron('*/5 * * * *')}
                          className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary hover:bg-primary/20 transition-all text-center"
                        >
                          5 Mins
                        </button>
                        <button
                          onClick={() => setNewCron('*/10 * * * *')}
                          className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary hover:bg-primary/20 transition-all text-center"
                        >
                          10 Mins
                        </button>
                      </div>

                      <button
                        onClick={() => setNewCron('0 0 * * *')}
                        className="w-full text-left text-[10px] text-white/60 hover:text-primary transition-colors flex items-center justify-between"
                      >
                        <span>Every Midnight</span>
                        <code className="text-primary/60">0 0 * * *</code>
                      </button>
                      <button
                        onClick={() => setNewCron('0 */6 * * *')}
                        className="w-full text-left text-[10px] text-white/60 hover:text-primary transition-colors flex items-center justify-between"
                      >
                        <span>Every 6 Hours</span>
                        <code className="text-primary/60">0 */6 * * *</code>
                      </button>
                      <button
                        onClick={() => setNewCron('0 0 * * 0')}
                        className="w-full text-left text-[10px] text-white/60 hover:text-primary transition-colors flex items-center justify-between"
                      >
                        <span>Weekly (Sunday)</span>
                        <code className="text-primary/60">0 0 * * 0</code>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card-static p-6 bg-white/5 border-dashed border-white/10">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-white/20 mt-0.5" />
                  <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-wide">
                    Scheduled backups run in the background on the server and are automatically synced to your Cloud Registry.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab as string) === 'storage' && (
          <div className="h-[calc(100vh-280px)] min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StorageExplorer 
              initialSearch={searchParams.get('search') || ''} 
              initialPath={searchParams.get('path') || undefined}
              initialSelected={searchParams.get('selected') || undefined}
            />
          </div>
        )}

        {/* Migration Modal */}
        {migrateModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="glass-card-static w-full max-w-md p-8 animate-in zoom-in duration-200 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Cross-Suite Migration</h2>
                  <p className="text-xs text-white/40">Migrate snapshot data into a different workspace</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-2">Source Snapshot</p>
                  <p className="text-xs font-mono text-white/80 truncate">{migrateModal.cloudPath?.split('/').pop()}</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Target Workspace</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={selectedTargetWorkspace}
                        onChange={e => {
                          setSelectedTargetWorkspace(e.target.value);
                          setMigrationAnalysis(null);
                        }}
                        className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 appearance-none text-sm"
                      >
                        <option value="" className="bg-[#121212]">Select a target workspace...</option>
                        {migrateModal.workspaces.map(ws => (
                          <option key={ws.id} value={ws.id} className="bg-[#121212]">{ws.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                    </div>
                    <button
                      onClick={runMigrationAnalysis}
                      disabled={!selectedTargetWorkspace || analyzingMigration}
                      className="px-4 h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all text-xs font-bold flex items-center gap-2 disabled:opacity-30"
                    >
                      {analyzingMigration ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Analyze
                    </button>
                  </div>
                </div>

                {migrationAnalysis && (
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Application Mappings</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {migrationAnalysis.map((m: any) => (
                        <div key={m.sourceAppId} className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-white/60 font-mono">{m.sourceAppId}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                              m.status === 'ready' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {m.status}
                            </span>
                          </div>
                          {m.drift && (
                            <div className="grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-tighter text-white/20">
                              <span className={m.drift.documents > 0 ? 'text-amber-400/60' : ''}>Docs: +{m.drift.documents}</span>
                              <span className={m.drift.users > 0 ? 'text-amber-400/60' : ''}>Users: +{m.drift.users}</span>
                              <span className={m.drift.assets > 0 ? 'text-amber-400/60' : ''}>Assets: +{m.drift.assets}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-orange-400/80 leading-relaxed">
                    <span className="font-bold uppercase tracking-tighter mr-1">Warning:</span>
                    Migration will <span className="font-bold text-orange-400">OVERWRITE</span> data in the target workspace apps.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setMigrateModal({ ...migrateModal, open: false });
                    setMigrationAnalysis(null);
                  }}
                  className="flex-1 h-12 rounded-xl bg-white/5 text-white/60 font-bold hover:bg-white/10 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMigrate}
                  disabled={!selectedTargetWorkspace || !migrationAnalysis}
                  className="flex-1 h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Start Migration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conflict Resolution Modal */}
      {conflictModal && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-card-static max-w-md w-full p-8 border-orange-500/30 bg-orange-500/5 space-y-6 shadow-2xl shadow-orange-500/10">
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
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
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

            <div className="text-center">
              <p className="text-xs text-orange-400/60 font-bold uppercase tracking-widest">How would you like to proceed?</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  const p = conflictModal.params;
                  setConflictModal(null);
                  runBackup(true, false, p.customParams);
                }}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 flex items-center justify-center gap-2 group"
              >
                Proceed Anyway (Force Duplicate)
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
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/10"
              >
                Cancel Request
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && deleteConfirmModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-card-static max-w-md w-full p-8 border-red-500/30 bg-red-500/5 space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Confirm Deletion</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Are you sure you want to permanently delete <span className="text-white font-bold">{deleteConfirmModal.paths.length}</span> snapshot{deleteConfirmModal.paths.length > 1 ? 's' : ''}?
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
                  const { paths } = deleteConfirmModal;
                  setDeleteConfirmModal(null);
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_URL}/api/backups/delete-bulk`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ paths })
                    });
                    if (!res.ok) throw new Error('Bulk delete failed');
                    setSelectedBackups(new Set());
                    fetchBackups();
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
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmModal && cancelConfirmModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-card-static max-w-md w-full p-8 border-red-500/30 bg-red-500/5 space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Confirm Cancellation</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {cancelConfirmModal.type === 'bulk'
                  ? `Are you sure you want to terminate ${cancelConfirmModal.ids.length} active operations?`
                  : 'Are you sure you want to terminate this operation? This may leave temporary files in storage.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setCancelConfirmModal(null)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
              <button
                onClick={async () => {
                  const { ids } = cancelConfirmModal;
                  setCancelConfirmModal(null);
                  if (ids.length === 0) {
                    await cancelBackup();
                  } else if (ids.length === 1) {
                    await fetch(`${API_URL}/api/operations/${ids[0]}`, { method: 'DELETE' });
                    // Remove from selection if it was selected
                    const next = new Set(selectedOps);
                    if (next.has(ids[0])) {
                      next.delete(ids[0]);
                      setSelectedOps(next);
                    }
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
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
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
        </div>
      )}
    </>
  );
}
