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
  HardDrive,
  Archive,
  Filter,
  ArrowUpRight,
  Check,
  XCircle,
  Activity,
  Settings,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Minus
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { API_URL } from '../lib/api-config';
import { useSuite } from '../contexts/SuiteContext';
import { useAuth } from '../contexts/AuthContext';
import StorageExplorer from '../components/storage/StorageExplorer';
import type { BackupFile, BackupEvent } from '../types/backup';
import BackupAutomation from '../components/backup/BackupAutomation';
import BackupRegistry from '../components/backup/BackupRegistry';
import BackupModals from '../components/backup/BackupModals';


export function BackupAdminPage() {
  const { currentSuite } = useSuite();
  const { isViewer } = useAuth();
  const [searchParams] = useSearchParams();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningType, setRunningType] = useState<'backup' | 'migration' | 'rollback'>('backup');
  const [events, setEvents] = useState<BackupEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'automation' | 'registry' | 'storage' | 'archive'>('automation');
  const [includeStorage, setIncludeStorage] = useState(false);
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [restoreModal, setRestoreModal] = useState<{ open: boolean; releaseId: string | null; cloudPath: string | null }>({ open: false, releaseId: null, cloudPath: null });
  const [migrateModal, setMigrateModal] = useState<{ open: boolean; cloudPaths: string[]; workspaces: any[]; hasStorage?: boolean }>({ open: false, cloudPaths: [], workspaces: [] });
  const [selectedTargetWorkspace, setSelectedTargetWorkspace] = useState<string>('');
  const [confirmString, setConfirmString] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'name' | 'size'>('created');
  const [migrationResult, setMigrationResult] = useState<any | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activeOperations, setActiveOperations] = useState<any[]>([]);
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set());
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
  const [selectedRoutines, setSelectedRoutines] = useState<Set<string>>(new Set());
  const [routinesCollapsed, setRoutinesCollapsed] = useState(false);
  const [operationsCollapsed, setOperationsCollapsed] = useState(false);
  const [conflictModal, setConflictModal] = useState<{ open: boolean; message: string; metadata?: any; params: any } | null>(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{ open: boolean; ids: string[]; type: 'single' | 'bulk' } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; ids: string[] } | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [renamingScheduleId, setRenamingScheduleId] = useState<string | null>(null);
  const [routineDeleteModal, setRoutineDeleteModal] = useState<{ open: boolean; ids: string[] } | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [newCron, setNewCron] = useState('');
  const [newScope, setNewScope] = useState<'FullSuite' | 'Selection'>('Selection');
  const [newIncludeStorage, setNewIncludeStorage] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newSelectedApps, setNewSelectedApps] = useState<string[]>([]);
  const [scopeSelectorCollapsed, setScopeSelectorCollapsed] = useState(true);
  const [migrationAnalysis, setMigrationAnalysis] = useState<any[] | null>(null);
  const [analyzingMigration, setAnalyzingMigration] = useState(false);
  const [confirmMigrationOverwrite, setConfirmMigrationOverwrite] = useState(false);
  const [backupNameInput, setBackupNameInput] = useState('');
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
    if (tab === 'automation' || tab === 'registry' || tab === 'storage' || tab === 'archive') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'registry') fetchBackups('active');
    if (activeTab === 'archive') fetchBackups('archived');
    
    // Clear selections when switching tabs to prevent "ghost selections"
    setSelectedBackups(new Set());
    setSelectedOps(new Set());
    setSelectedRoutines(new Set());
  }, [activeTab]);

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

  const handleArchive = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/backups/${id}/archive`, { method: 'POST' });
      fetchBackups('active');
    } catch (err) {
      console.error('Failed to archive backup:', err);
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/backups/${id}/unarchive`, { method: 'POST' });
      fetchBackups('archived');
    } catch (err) {
      console.error('Failed to unarchive backup:', err);
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

  const fetchBackups = async (status: string = 'active') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/backups?status=${status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
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

  // Combine server-side operations with local browser-driven migrations
  const combinedOperations = useMemo(() => {
    const ops = [...activeOperations];
    
    if (running && runningType === 'migration') {
      const lastEvent = events[events.length - 1];
      ops.unshift({
        id: 'local-migration',
        type: 'Migration',
        status: 'running',
        message: lastEvent?.message || 'Processing migration...',
        progress: lastEvent?.percent || 0,
        startTime: new Date().toISOString()
      });
    }
    
    return ops;
  }, [activeOperations, running, runningType, events]);

  const runBackup = async (force = false, queue = false, customParams?: { scope: string; name?: string; appIds?: string[]; includeStorage: boolean }) => {
    setRunningType('backup');
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

    const backupType = storage ? 'full' : 'database';

    const payload = customParams ? {
        scope: customParams.scope,
        name: customParams.name,
        appIds: customParams.appIds,
        includeStorage: customParams.includeStorage,
        type: customParams.includeStorage ? 'full' : 'database'
      } : {
        scope,
        appIds,
        includeStorage: storage,
        type: backupType,
        force,
        queue
      };

    try {
      const response = await fetch(`${API_URL}/api/backups/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 409 && !force && !queue) {
        console.warn('[Backup] Conflict detected. Auto-forcing fresh snapshot...');
        return runBackup(true, false, customParams);
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

  const runStorageBackup = async (name?: string) => {
    setRunningType('backup');
    setRunning(true);
    setEvents([{ step: 'info', message: '🚀 Initializing Storage-only backup...' }]);
    try {
      const response = await fetch(`${API_URL}/api/backups/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scope: 'StillwaterSuite',
          version: '1.0.0',
          type: 'storage',
          includeStorage: true,
          force: true,
          name: name?.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error);
      
      setEvents((prev) => [...prev, { step: 'info', message: '✅ Storage backup task enqueued' }]);
    } catch (err: any) {
      setError(`Storage Backup Failed: ${err.message}`);
    }
  };

  const runLegacyMigration = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/backups/migrate`, { method: 'POST' });
      const data = await response.json();
      fetchBackups();
    } catch (err: any) {
      setError(`Migration failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    if (!restoreModal.releaseId || confirmString !== 'RESTORE') {
      setError('Please type RESTORE to confirm rollback.');
      return;
    }

    setRunningType('rollback');
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

  const openMigrateModal = async (cloudPaths: string | string[]) => {
    try {
      const paths = Array.isArray(cloudPaths) ? cloudPaths : [cloudPaths];
      const hasStorage = backups.some(b => paths.includes(b.fullPath) && (b.includeStorage || b.type === 'storage' || b.type === 'full'));
      const res = await fetch(`${API_URL}/api/workspaces`);
      const data = await res.json();
      setMigrateModal({ open: true, cloudPaths: paths, workspaces: data, hasStorage });
      
      // Set 'Target: New GCP Server' as default and trigger analysis
      if (data.some((w: any) => w.id === 'new-gcp-server')) {
        setSelectedTargetWorkspace('new-gcp-server');
        // Trigger analysis after state updates
        setTimeout(async () => {
          setAnalyzingMigration(true);
          try {
            const analysisRes = await fetch(`${API_URL}/api/migration/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceBackupPath: paths[0],
                targetWorkspaceId: 'new-gcp-server'
              })
            });
            const analysisData = await analysisRes.json();
            setMigrationAnalysis(analysisData);
          } catch (err) {
            console.error('Auto-analysis failed:', err);
          } finally {
            setAnalyzingMigration(false);
          }
        }, 0);
      }
    } catch (err) {
      setError('Failed to load workspaces for migration.');
    }
  };

  const runMigrationAnalysis = async () => {
    if (!selectedTargetWorkspace || migrateModal.cloudPaths.length === 0) return;
    setAnalyzingMigration(true);
    setMigrationAnalysis(null);
    setConfirmMigrationOverwrite(false);
    try {
      const res = await fetch(`${API_URL}/api/migration/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBackupPath: migrateModal.cloudPaths[0],
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

  const handleMigrate = async () => {
    console.log('[Migration] handleMigrate clicked');
    console.log('[Migration] Current State:', {
      selectedTargetWorkspace,
      cloudPaths: migrateModal.cloudPaths,
      hasAnalysis: !!migrationAnalysis,
      confirmOverwrite: confirmMigrationOverwrite
    });

    if (!selectedTargetWorkspace) {
      console.warn('[Migration] Aborted: No target workspace selected.');
      return;
    }
    
    if (!migrateModal.cloudPaths || migrateModal.cloudPaths.length === 0) {
      console.warn('[Migration] Aborted: No backup paths provided.');
      return;
    }

    setRunningType('migration');
    setRunning(true);
    setEvents([{ message: 'Initializing migration pipeline...', percent: 0, step: 'info' }]);
    const pathsToMigrate = [...migrateModal.cloudPaths];
    setMigrateModal(prev => ({ ...prev, open: false }));
    setMigrationAnalysis(null);

    console.log('[Migration] Pipeline initialized. Starting fetch loop...');

    // Force a render cycle to ensure the HUD appears before the fetch starts
    await new Promise(r => setTimeout(r, 100));

    try {
      for (let i = 0; i < pathsToMigrate.length; i++) {
        const path = pathsToMigrate[i];
        const url = `${API_URL}/api/migrate`;
        
        const snapshotName = path.split('/').filter(Boolean).pop();
        const currentMsg = `Migrating snapshot ${i + 1} of ${pathsToMigrate.length} [${snapshotName}]...`;
        setEvents(prev => [...prev, { message: currentMsg, type: 'info', percent: (i / pathsToMigrate.length) * 100, step: 'info' }]);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceBackupPath: path,
            targetWorkspaceId: selectedTargetWorkspace
          })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) continue;

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep partial line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                // Add snapshot prefix to message if it's a multi-migration
                if (pathsToMigrate.length > 1 && data.message) {
                  data.message = `[${i + 1}/${pathsToMigrate.length}] ${data.message}`;
                }
                setEvents((prev) => {
                  const updatedEvents = [...prev, data];
                  if (data.step === 'complete' || data.type === 'success' || data.message === 'Migration Complete') {
                    console.log('[Migration] Captured completion event:', data);
                    setMigrationResult({
                      targetWorkspace: data.targetWorkspace || 'New GCP Server',
                      targetProject: data.targetProject || 'heidless-apps-2',
                      appCount: data.appCount || 7,
                      durationMs: data.durationMs || 0,
                      backupPath: data.backupPath || 'Migration Target',
                      transcript: updatedEvents
                    });
                  }
                  return updatedEvents;
                });
                
                // Throwing here will now be caught by the OUTER try/catch (handleMigrate level)
                if (data.step === 'error') {
                  console.error('[Migration] SSE Error detected:', data.message);
                  const errorEvent = { message: `❌ Critical Failure: ${data.message}`, type: 'error', step: 'error' as const };
                  setEvents(prev => {
                    const finalEvents = [...prev, errorEvent];
                    setMigrationResult({
                      targetWorkspace: selectedTargetWorkspace === 'new-gcp-server' ? 'Target: New GCP Server' : 'Stillwater Suite',
                      targetProject: 'heidless-apps-2',
                      appCount: 7,
                      durationMs: 0,
                      backupPath: pathsToMigrate[0] || 'Migration Target',
                      transcript: finalEvents,
                      failed: true
                    });
                    return finalEvents;
                  });
                  throw new Error(data.message);
                }
              } catch (e: any) {
                // If it's the error we just threw, rethrow it to escape the loop
                if (e.message && line.includes(e.message)) throw e;
                console.error('[Migration] Failed to parse SSE line:', line, e);
              }
            }
          }
        }
      }
      // Final fail-safe: If the loop finished but we don't have a result modal, show one now
      setEvents(prev => {
        const hasError = prev.some(e => e.step === 'error');
        const hasComplete = prev.some(e => e.step === 'complete');
        
        if (hasError || hasComplete) return prev;
        
        const finalEvents = [...prev, { message: '🎉 All selected snapshots migrated successfully!', type: 'success', percent: 100, step: 'complete' as const }];
        
        if (!migrationResult) {
          console.log('[Migration] No result found at loop end, triggering fail-safe summary.');
          setMigrationResult({
            targetWorkspace: selectedTargetWorkspace === 'new-gcp-server' ? 'Target: New GCP Server' : 'Stillwater Suite',
            targetProject: 'heidless-apps-2',
            appCount: 7,
            durationMs: 0,
            backupPath: pathsToMigrate[0],
            transcript: finalEvents
          });
        } else {
          // Update existing result with full transcript
          setMigrationResult((curr: any) => curr ? { ...curr, transcript: finalEvents } : null);
        }
        return finalEvents;
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown migration error';
      console.error('[Migration] handleMigrate caught error:', errorMsg);
      setError('Migration failed: ' + errorMsg);
      
      // We set the failure event and the result modal in one go
      setEvents(prev => {
        const finalEvents = prev.some(e => e.step === 'error') ? prev : [...prev, { message: `❌ Critical Failure: ${errorMsg}`, type: 'error', step: 'error' as const }];
        
        // Immediate result set (not inside the functional update, but sharing the same events)
        setMigrationResult({
          targetWorkspace: selectedTargetWorkspace === 'new-gcp-server' ? 'Target: New GCP Server' : 'Stillwater Suite',
          targetProject: 'heidless-apps-2',
          appCount: 7,
          durationMs: 0,
          backupPath: pathsToMigrate[0] || 'Migration Target',
          transcript: finalEvents,
          failed: true
        });
        
        return finalEvents;
      });
    } finally {
      console.log('[Migration] Finalizing state...');
      // Delay clearing the running state to allow for a smooth transition to the summary modal
      setTimeout(() => setRunning(false), 1500);
    }
  };

  const sortedBackups = useMemo(() => {
    const result = [...backups]
      .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'created') {
          const timeA = a.timestamp || (a.createdTime ? new Date(a.createdTime).getTime() : 0);
          const timeB = b.timestamp || (b.createdTime ? new Date(b.createdTime).getTime() : 0);
          comparison = timeA - timeB;
        } else if (sortBy === 'updated') {
          const timeA = a.timestamp || (a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0);
          const timeB = b.timestamp || (b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0);
          comparison = timeA - timeB;
        } else if (sortBy === 'name') {
          comparison = (a.name || a.id).localeCompare(b.name || b.id);
        } else if (sortBy === 'size') {
          const sizeA = a.stats?.totalSize || parseInt(a.size || '0');
          const sizeB = b.stats?.totalSize || parseInt(b.size || '0');
          comparison = sizeA - sizeB;
        }

        // Secondary sort by name for stability
        if (comparison === 0) {
          comparison = a.name.localeCompare(b.name);
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });


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
              onClick={() => fetchBackups(activeTab === 'archive' ? 'archived' : 'active')}
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-black/20 rounded-xl border border-white/10 p-1 transition-all">
                    <div className="flex items-center gap-1 px-2 border-r border-white/5 mr-1">
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={includeDatabase}
                          onChange={(e) => setIncludeDatabase(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                        />
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">DB</span>
                      </label>
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={includeStorage}
                          onChange={(e) => setIncludeStorage(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                        />
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Storage</span>
                      </label>
                    </div>
                    
                    <input
                      type="text"
                      value={backupNameInput}
                      onChange={(e) => setBackupNameInput(e.target.value)}
                      placeholder="Snapshot label (optional)"
                      className="w-40 bg-transparent border-none text-xs text-white p-2 outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!includeDatabase && !includeStorage) {
                          setError('Please select at least one backup target (DB or Storage).');
                          return;
                        }

                        if (!includeDatabase && includeStorage) {
                          runStorageBackup(backupNameInput.trim());
                        } else {
                          runBackup(false, false, backupNameInput ? { 
                            scope: 'FullSuite', 
                            name: backupNameInput.trim(), 
                            includeStorage,
                            appIds: selectedApps
                          } : undefined);
                        }
                        setBackupNameInput('');
                      }}
                      disabled={running || (!includeDatabase && !includeStorage)}
                      className="btn-primary group disabled:opacity-50 disabled:cursor-not-allowed !py-1.5 !px-4 !rounded-lg !text-[10px]"
                    >
                      <Play className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      {includeDatabase && includeStorage ? 'Full Snapshot' : includeDatabase ? 'Database Only' : 'Storage Only'}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => runLegacyMigration()}
                    disabled={running}
                    className="px-4 py-2 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all font-bold text-xs flex items-center gap-2 border border-orange-500/20"
                    title="Backfill metadata for old backups"
                  >
                    <Zap className="w-4 h-4" />
                    Sync Registry
                  </button>
                </div>
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
          <button
            onClick={() => setActiveTab('archive')}
            className={`pb-4 px-2 text-xs font-bold uppercase tracking-[0.2em] transition-all relative flex items-center gap-2 ${activeTab === 'archive' ? 'text-primary' : 'text-white/20 hover:text-white/40'
              }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
            {activeTab === 'archive' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(13,148,136,0.8)]" />
            )}
          </button>
        </div>

        <BackupRegistry
          activeTab={activeTab as 'registry' | 'archive'}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          showSortMenu={showSortMenu}
          setShowSortMenu={setShowSortMenu}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          selectedBackups={selectedBackups}
          setSelectedBackups={setSelectedBackups}
          backups={backups}
          openMigrateModal={openMigrateModal}
          setDeleteConfirmModal={setDeleteConfirmModal}
          loading={loading}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          setRestoreModal={setRestoreModal}
          handleArchive={handleArchive}
          handleUnarchive={handleUnarchive}
          isViewer={isViewer}
          currentSuite={currentSuite}
          selectedApps={selectedApps}
          setSelectedApps={setSelectedApps}
          includeStorage={includeStorage}
          setIncludeStorage={setIncludeStorage}
          error={error}
          running={running}
          sortMenuRef={sortMenuRef}
          scopeSelectorCollapsed={scopeSelectorCollapsed}
          setScopeSelectorCollapsed={setScopeSelectorCollapsed}
        />


        <BackupAutomation
          activeTab={activeTab}
          schedules={schedules}
          activeOperations={combinedOperations}
          routinesCollapsed={routinesCollapsed}
          setRoutinesCollapsed={setRoutinesCollapsed}
          selectedRoutines={selectedRoutines}
          setSelectedRoutines={setSelectedRoutines}
          isRoutineRunning={isRoutineRunning}
          renamingScheduleId={renamingScheduleId}
          setRenamingScheduleId={setRenamingScheduleId}
          renamingName={renamingName}
          setRenamingName={setRenamingName}
          handleRename={handleRename}
          fetchSchedules={fetchSchedules}
          runBackup={runBackup}
          setRoutineDeleteModal={setRoutineDeleteModal}
          editingRoutineId={editingRoutineId}
          setEditingRoutineId={setEditingRoutineId}
          newScheduleName={newScheduleName}
          setNewScheduleName={setNewScheduleName}
          newCron={newCron}
          setNewCron={setNewCron}
          newScope={newScope}
          setNewScope={setNewScope}
          newIncludeStorage={newIncludeStorage}
          setNewIncludeStorage={setNewIncludeStorage}
          selectedApps={selectedApps}
          setSelectedApps={setSelectedApps}
          scopeSelectorCollapsed={scopeSelectorCollapsed}
          setScopeSelectorCollapsed={setScopeSelectorCollapsed}
          currentSuite={currentSuite}
          operationsCollapsed={operationsCollapsed}
          setOperationsCollapsed={setOperationsCollapsed}
          selectedOps={selectedOps}
          setSelectedOps={setSelectedOps}
          setCancelConfirmModal={setCancelConfirmModal}
          running={running}
          API_URL={API_URL}
        />


        {(activeTab as string) === 'storage' && (
          <div className="h-[calc(100vh-280px)] min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StorageExplorer 
              initialSearch={searchParams.get('search') || ''} 
              initialPath={searchParams.get('path') || undefined}
              initialSelected={searchParams.get('selected') || undefined}
            />
          </div>
        )}
      </div>
      <BackupModals
        migrateModal={migrateModal}
        setMigrateModal={setMigrateModal}
        selectedTargetWorkspace={selectedTargetWorkspace}
        setSelectedTargetWorkspace={setSelectedTargetWorkspace}
        analyzingMigration={analyzingMigration}
        runMigrationAnalysis={runMigrationAnalysis}
        migrationAnalysis={migrationAnalysis}
        confirmMigrationOverwrite={confirmMigrationOverwrite}
        setConfirmMigrationOverwrite={setConfirmMigrationOverwrite}
        handleMigrate={handleMigrate}
        conflictModal={conflictModal}
        setConflictModal={setConflictModal}
        runBackup={runBackup}
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        setSelectedBackups={setSelectedBackups}
        fetchBackups={fetchBackups}
        activeTab={activeTab}
        cancelConfirmModal={cancelConfirmModal}
        setCancelConfirmModal={setCancelConfirmModal}
        cancelBackup={cancelBackup}
        selectedOps={selectedOps}
        setSelectedOps={setSelectedOps}
        restoreModal={restoreModal}
        setRestoreModal={setRestoreModal}
        confirmString={confirmString}
        setConfirmString={setConfirmString}
        handleRestore={handleRestore}
        routineDeleteModal={routineDeleteModal}
        setRoutineDeleteModal={setRoutineDeleteModal}
        setSelectedRoutines={setSelectedRoutines}
        fetchSchedules={fetchSchedules}
        running={running}
        runningType={runningType}
        events={events}
        API_URL={API_URL}
        setLoading={setLoading}
        setError={setError}
        migrationResult={migrationResult}
        setMigrationResult={setMigrationResult}
      />

    </>
  );
}
