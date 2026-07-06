import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Mail, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  RefreshCw, 
  Loader2, 
  Calendar, 
  Inbox,
  ShieldAlert,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface Broadcast {
  id: string;
  subject: string;
  category: 'system' | 'marketing' | 'policy';
  from: string;
  body: string;
  templateKey: string;
  recipientTarget: string;
  scheduledAt: string;
  status: 'queued' | 'sending' | 'complete' | 'failed';
  createdAt: string;
  completedAt?: string;
  sentCount: number;
  failedCount: number;
  error?: string | null;
}

interface RecipientLog {
  id: string;
  email: string;
  name: string;
  tier: string;
  status: 'sent' | 'failed' | 'skipped';
  sentAt: string;
  error?: string | null;
}

export function BroadcastAdminPage() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Record<string, RecipientLog[]>>({});
  const [loadingRecipients, setLoadingRecipients] = useState<string | null>(null);
  
  // Filtering and Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const API_URL = import.meta.env.VITE_SUITEUTILS_API_URL || 'http://localhost:5185';

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    try {
      if (!user) return;
      const idToken = await user.getIdToken();
      const response = await fetch(`${API_URL}/api/admin/broadcast/history`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch broadcast logs');
      }
      const data = await response.json();
      if (data.success) {
        setBroadcasts(data.broadcasts || []);
      }
    } catch (err) {
      console.error('[BroadcastDashboard] Error loading broadcasts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRecipientLogs = async (broadcastId: string) => {
    if (recipients[broadcastId]) return; // already loaded
    
    setLoadingRecipients(broadcastId);
    try {
      if (!user) return;
      const idToken = await user.getIdToken();
      const response = await fetch(`${API_URL}/api/admin/broadcast/history/${broadcastId}/recipients`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch recipient details');
      }
      const data = await response.json();
      if (data.success) {
        setRecipients(prev => ({
          ...prev,
          [broadcastId]: data.recipients || []
        }));
      }
    } catch (err) {
      console.error('[BroadcastDashboard] Error loading recipients:', err);
    } finally {
      setLoadingRecipients(null);
    }
  };

  const handleToggleExpand = async (broadcastId: string) => {
    if (expandedId === broadcastId) {
      setExpandedId(null);
    } else {
      setExpandedId(broadcastId);
      await fetchRecipientLogs(broadcastId);
    }
  };

  // Compute overall stats
  const totalCampaigns = broadcasts.length;
  const totalSent = broadcasts.reduce((acc, curr) => acc + (curr.sentCount || 0), 0);
  const totalFailed = broadcasts.reduce((acc, curr) => acc + (curr.failedCount || 0), 0);
  const totalPending = broadcasts.filter(b => b.status === 'queued' || b.status === 'sending').length;

  const filteredBroadcasts = broadcasts.filter(b => {
    const matchesSearch = b.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.recipientTarget.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || b.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'system':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'marketing':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'policy':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'sending':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'queued':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'failed':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-white/5 text-white/50 border border-white/5';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-white/40 text-sm font-medium">Analyzing Campaign Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" style={{ animationDuration: '0.4s' }}>
      
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-primary/10 text-primary">
              <Mail className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Campaign Analytics</h1>
          </div>
          <p className="text-xs text-white/40">
            Real-time audit dashboard monitoring delivery metrics, unsubscribe actions, and SMTP transmission queues.
          </p>
        </div>
        <button
          onClick={() => fetchBroadcasts(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all text-white/70 active:scale-95 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
          Refresh Metrics
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5" style={{ background: 'radial-gradient(circle at top left, rgba(13, 148, 136, 0.04) 0%, transparent 100%)' }}>
          <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">Delivered Emails</span>
          <div className="text-2xl font-bold font-mono text-white">{totalSent.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Successful Deliveries
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5" style={{ background: 'radial-gradient(circle at top left, rgba(239, 68, 68, 0.04) 0%, transparent 100%)' }}>
          <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">Failed Transmissions</span>
          <div className="text-2xl font-bold font-mono text-white">{totalFailed.toLocaleString()}</div>
          <div className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Blocked/Choked Emails
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5" style={{ background: 'radial-gradient(circle at top left, rgba(245, 158, 11, 0.04) 0%, transparent 100%)' }}>
          <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">Active Queue</span>
          <div className="text-2xl font-bold font-mono text-white">{totalPending}</div>
          <div className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Pending/Sending
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5" style={{ background: 'radial-gradient(circle at top left, rgba(13, 148, 136, 0.04) 0%, transparent 100%)' }}>
          <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">Total Broadcasts</span>
          <div className="text-2xl font-bold font-mono text-white">{totalCampaigns}</div>
          <div className="text-[10px] text-white/40 font-medium flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-primary" /> Multi-recipient Jobs
          </div>
        </div>

      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col md:flex-row items-center gap-4 text-xs">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            placeholder="Search campaign subject or target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 hover:border-white/20 focus:border-primary/50 transition-colors rounded-xl py-2 pl-9 pr-4 text-white placeholder:text-white/20 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end ml-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-white/30 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/80 focus:outline-none focus:border-primary/50"
            >
              <option value="all">All Categories</option>
              <option value="system">System Alert</option>
              <option value="marketing">Marketing</option>
              <option value="policy">Policy & Legal</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-white/30 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/80 focus:outline-none focus:border-primary/50"
            >
              <option value="all">All States</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
              <option value="complete">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

      </div>

      {/* Campaigns Table / Grid */}
      {filteredBroadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl p-6 space-y-3">
          <Inbox className="w-10 h-10 text-white/10 animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-white font-semibold text-sm">No campaign records matched</h3>
            <p className="text-xs text-white/30 max-w-sm mx-auto">
              Modify your filter parameters or search queries to discover historic campaigns.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-white/70">
              
              <thead className="bg-white/[0.02] border-b border-white/5 font-semibold text-white/40 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Broadcast Campaign</th>
                  <th className="py-3.5 px-4">Delivery Window</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Metrics (Sent/Fail)</th>
                  <th className="py-3.5 px-5 w-10"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredBroadcasts.map((b) => {
                  const isExpanded = expandedId === b.id;
                  return (
                    <Fragment key={b.id}>
                      {/* Row Header Trigger */}
                      <tr 
                        onClick={() => handleToggleExpand(b.id)}
                        className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                      >
                        <td className="py-4 px-5">
                          <div className="space-y-1.5 max-w-md">
                            <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getCategoryStyles(b.category)}`}>
                              {b.category}
                            </span>
                            <div className="text-sm font-semibold text-white line-clamp-1">{b.subject}</div>
                            <div className="text-[10px] font-mono text-white/30 flex items-center gap-1">
                              <Users className="w-3 h-3 text-primary" /> Target: {b.recipientTarget}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-white/50">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-xs text-white/70">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              {new Date(b.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-white/30 font-mono">
                              {new Date(b.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyles(b.status)}`}>
                            {b.status === 'queued' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
                            {b.status === 'sending' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                            {b.status === 'complete' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {b.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
                            <span className="capitalize">{b.status}</span>
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right font-mono font-bold whitespace-nowrap">
                          {b.status === 'queued' ? (
                            <span className="text-white/30">Queued</span>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-emerald-400 text-sm">
                                {b.sentCount} <span className="text-[10px] font-normal text-white/30">sent</span>
                              </span>
                              {b.failedCount > 0 && (
                                <span className="text-rose-400 text-[10px]">
                                  {b.failedCount} <span className="text-[9px] font-normal text-rose-400/40">failed</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-5 text-right text-white/30">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expanded Recipient Logs */}
                      {isExpanded && (
                        <tr className="bg-black/25">
                          <td colSpan={5} className="p-5 border-t border-white/5">
                            
                            <div className="space-y-4 max-w-4xl">
                              
                              {/* Metadata Row */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1.5 bg-white/[0.01] border border-white/5 p-3 rounded-lg">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">Campaign Details</div>
                                  <div className="space-y-1 font-mono text-[11px] text-white/60">
                                    <div>ID: <span className="text-white/90">{b.id}</span></div>
                                    <div>From: <span className="text-white/90">{b.from}</span></div>
                                    <div>CMS Template: <span className="text-white/90">{b.templateKey}</span></div>
                                  </div>
                                </div>

                                <div className="space-y-1.5 bg-white/[0.01] border border-white/5 p-3 rounded-lg">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">Content Draft</div>
                                  <p className="text-[11px] leading-relaxed text-white/60 font-mono whitespace-pre-wrap line-clamp-3 select-all bg-transparent outline-none border-none">
                                    {b.body}
                                  </p>
                                </div>
                              </div>

                              {/* Recipients Table */}
                              <div className="space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1">
                                  <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                                  Individual Delivery Manifest
                                </div>

                                {loadingRecipients === b.id ? (
                                  <div className="flex items-center gap-2 py-4 text-white/40 text-xs font-medium">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    Loading recipient logs...
                                  </div>
                                ) : !recipients[b.id] || recipients[b.id].length === 0 ? (
                                  <div className="p-4 rounded-lg bg-white/[0.01] border border-white/5 text-center text-white/30 text-xs">
                                    No recipient transmission logs found.
                                  </div>
                                ) : (
                                  <div className="border border-white/5 rounded-xl bg-black/40 overflow-hidden">
                                    <div className="max-h-[300px] overflow-y-auto pr-1">
                                      <table className="w-full border-collapse text-left text-[11px]">
                                        
                                        <thead className="bg-white/[0.02] border-b border-white/5 text-white/40 uppercase tracking-widest text-[9px] font-bold">
                                          <tr>
                                            <th className="py-2.5 px-4">Recipient</th>
                                            <th className="py-2.5 px-4 text-center">Tier</th>
                                            <th className="py-2.5 px-4 text-center">Status</th>
                                            <th className="py-2.5 px-4 text-right">Processed Time</th>
                                          </tr>
                                        </thead>

                                        <tbody className="divide-y divide-white/5 font-medium text-white/70">
                                          {recipients[b.id].map((rec) => (
                                            <tr key={rec.id} className="hover:bg-white/[0.01]">
                                              <td className="py-2.5 px-4 truncate max-w-xs">
                                                <div className="flex flex-col">
                                                  <span className="text-white/90 font-bold">{rec.email}</span>
                                                  {rec.name && <span className="text-[9px] text-white/30">Name: {rec.name}</span>}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                                <span className="uppercase text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-white/50">
                                                  {rec.tier}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                                {rec.status === 'sent' && (
                                                  <span className="text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Delivered</span>
                                                )}
                                                {rec.status === 'skipped' && (
                                                  <span className="text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10" title={rec.error || undefined}>Skipped</span>
                                                )}
                                                {rec.status === 'failed' && (
                                                  <span className="text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10" title={rec.error || undefined}>Failed</span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-white/40">
                                                {new Date(rec.sentAt).toLocaleDateString()} {new Date(rec.sentAt).toLocaleTimeString()}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>

                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>

                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>

            </table>
          </div>
        </div>
      )}

    </div>
  );
}
