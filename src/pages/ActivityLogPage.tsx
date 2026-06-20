import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  RotateCcw,
  Cloud,
  Rocket,
  Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { API_URL } from '../lib/api-config';

interface AuditEvent {
  id: string;
  timestamp: string;
  type: 'backup' | 'restore' | 'release' | 'system';
  action: string;
  status: 'success' | 'failure' | 'info' | 'cancelled';
  details: string;
  appId?: string;
  user?: string;
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('backup');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [clearConfirmModal, setClearConfirmModal] = useState<{ open: boolean; type: string }>({ open: false, type: 'all' });
  const [deleteItemModal, setDeleteItemModal] = useState<{ open: boolean; id: string | null; action: string | null }>({ open: false, id: null, action: null });

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/audit-logs`);
      const data = await res.json();
      setLogs(data.reverse()); // Show newest first
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.appId?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  }).sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failure': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled': return <RotateCcw className="w-4 h-4 text-orange-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'backup': return <Cloud className="w-4 h-4" />;
      case 'release': return <Rocket className="w-4 h-4" />;
      case 'restore': return <RotateCcw className="w-4 h-4" />;
      default: return <ClipboardList className="w-4 h-4" />;
    }
  };

  const getBackupLink = (action: string) => {
    if (!action.endsWith('.zip')) return `/backups?tab=storage&search=${encodeURIComponent(action)}`;
    
    const releaseId = action.replace('.zip', '');
    const parts = releaseId.split('_v');
    if (parts.length < 2) return `/backups?tab=storage&search=${encodeURIComponent(action)}`;
    
    const scope = parts[0];
    const rest = parts[1];
    const version = rest.split('_')[0];
    
    const dirPath = `AppSuite/backups/${scope}/releases/v${version}/${releaseId}/`;
    const fullPath = `${dirPath}${action}`;
    
    return `/backups?tab=storage&path=${encodeURIComponent(dirPath)}&selected=${encodeURIComponent(fullPath)}`;
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-between flex-1">
          <div>
            <h1 className="text-2xl font-bold text-white/90">Global Activity Log</h1>
            <p className="text-sm text-white/40 mt-1">Audit trail of all suite operations and system events</p>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 text-white/40 hover:text-primary hover:border-primary/20 transition-all flex items-center gap-4 group shadow-xl"
            title={sortOrder === 'desc' ? 'Switch to Oldest First' : 'Switch to Newest First'}
          >
            <div className="relative">
              <Filter className={`w-4 h-4 transition-transform duration-500 ${sortOrder === 'asc' ? 'rotate-180 text-primary' : ''}`} />
              <div className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse ${sortOrder === 'desc' ? 'hidden' : ''}`} />
            </div>
            <div className="text-left">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 leading-none mb-1.5">Sort Order</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/80 leading-none group-hover:text-primary transition-colors">
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="glass-card-static p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest">Search & Filter</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest">Event Category</h3>
            {(['all', 'backup', 'release', 'restore', 'system'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`w-full text-left px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  filterType === type 
                    ? 'bg-primary/20 text-primary border border-primary/20' 
                    : 'text-white/40 hover:bg-white/5'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
            
            <div className="pt-4 border-t border-white/5 mt-4">
              <button
                onClick={() => setClearConfirmModal({ open: true, type: filterType })}
                className="w-full px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 group flex items-center justify-between"
              >
                Clear {filterType === 'all' ? 'All' : filterType} Category
                <RotateCcw className="w-3.5 h-3.5 opacity-40 group-hover:rotate-[-90deg] transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Log Timeline */}
        <div className="md:col-span-3 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 glass-card-static">
              <Clock className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-white/40 text-sm">Fetching audit trail...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="space-y-3">
              {filteredLogs.map((log, i) => (
                <div key={i} className="glass-card-static p-4 hover:border-white/20 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg bg-white/5 text-white/20 group-hover:text-primary transition-colors`}>
                      {getTypeIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.type === 'backup' && log.action.endsWith('.zip') ? (
                            <Link 
                              to={getBackupLink(log.action)}
                              className="text-sm font-bold text-primary hover:text-primary/70 transition-colors flex items-center gap-2 group/link"
                            >
                              {log.action}
                              <Cloud className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </Link>
                          ) : (
                            <span className="text-sm font-bold text-white/90">{log.action}</span>
                          )}
                          {getStatusIcon(log.status)}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-white/20">
                            {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </span>
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              setDeleteItemModal({ open: true, id: log.id, action: log.action });
                            }}
                            className="p-1.5 rounded-lg bg-white/0 hover:bg-red-500/10 text-white/0 group-hover:text-red-400/40 hover:text-red-400 transition-all"
                            title="Remove from log"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">{log.details}</p>
                      {log.appId && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-white/40 uppercase tracking-wider">
                            {log.appId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 glass-card-static text-center">
              <ClipboardList className="w-12 h-12 text-white/5 mb-4" />
              <p className="text-white/40 text-sm">No activities found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {clearConfirmModal.open && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setClearConfirmModal({ ...clearConfirmModal, open: false })} 
          />
          <div className="relative w-full max-w-md glass-card-static p-8 border-red-500/30 bg-red-500/5 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <RotateCcw className="w-8 h-8 text-red-400" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Purge Activity Logs?</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                You are about to permanently delete all <span className="text-white font-bold">{clearConfirmModal.type === 'all' ? 'Activity' : clearConfirmModal.type}</span> logs. 
                This action <span className="text-red-400 font-bold uppercase underline decoration-2 underline-offset-4">cannot be undone</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => setClearConfirmModal({ ...clearConfirmModal, open: false })}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
              <button 
                onClick={async () => {
                  await fetch(`${API_URL}/api/audit-logs?type=${clearConfirmModal.type}`, { method: 'DELETE' });
                  setClearConfirmModal({ ...clearConfirmModal, open: false });
                  fetchLogs();
                }}
                className="px-4 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Individual Item Delete Confirmation Modal */}
      {deleteItemModal.open && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setDeleteItemModal({ ...deleteItemModal, open: false })} 
          />
          <div className="relative w-full max-w-md glass-card-static p-8 border-red-500/30 bg-red-500/5 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-400" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Remove Log Entry?</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                You are about to remove the entry for <span className="text-white font-bold">{deleteItemModal.action}</span>. 
                This action <span className="text-red-400 font-bold uppercase underline decoration-2 underline-offset-4">cannot be undone</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => setDeleteItemModal({ ...deleteItemModal, open: false })}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
              <button 
                onClick={async () => {
                  if (deleteItemModal.id) {
                    await fetch(`${API_URL}/api/audit-logs/${deleteItemModal.id}`, { method: 'DELETE' });
                    setDeleteItemModal({ open: false, id: null, action: null });
                    fetchLogs();
                  }
                }}
                className="px-4 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
