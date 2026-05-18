import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, RefreshCw, Loader2, ArrowRight, LayoutGrid, List, ArrowUp, ArrowDown, ExternalLink, ShieldAlert, History, Copy, Search, CheckCircle2, XCircle, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { API_URL } from '../../lib/api-config';
import { cn } from '../../lib/utils';
import ValidationDrawer from './ValidationModal';

interface Validation {
  id: string;
  feature: string;
  title: string;
  tag: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'PARKED';
  instructions: string;
  expectedResult: string;
  lastUpdated: string;
  group: string;
  sequence: number;
}

type ViewMode = 'GROUPED' | 'STANDARD';
type SortField = 'name' | 'timestamp' | 'status' | 'feature' | 'sequence';
type SortOrder = 'ASC' | 'DESC';

interface ValidationConsoleProps {
  selectedId?: string;
  onSelect: (v: Validation | null) => void;
  compact?: boolean;
  refreshTrigger?: number;
}

export default function ValidationConsole({ selectedId, onSelect, compact = false, refreshTrigger }: ValidationConsoleProps) {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('GROUPED');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [statusFilters, setStatusFilters] = useState<('PASS' | 'PENDING' | 'FAIL')[]>(['PENDING', 'PASS', 'FAIL']);

  const toggleStatusFilter = (status: 'PASS' | 'PENDING' | 'FAIL') => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [copiedValId, setCopiedValId] = useState<string | null>(null);

  const handleCopyGroup = (groupName: string) => {
    navigator.clipboard.writeText(groupName);
    setCopiedGroup(groupName);
    setTimeout(() => setCopiedGroup(null), 1500);
  };

  const handleCopyValId = (v: Validation) => {
    const displayId = getDisplayId(v);
    navigator.clipboard.writeText(displayId);
    setCopiedValId(v.id);
    setTimeout(() => setCopiedValId(null), 1500);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const fetchValidations = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/validations`, {
        headers: { 'x-workspace-id': 'stillwater-suite' }
      });
      const data = await res.json();
      setValidations(data);
    } catch (err) {
      console.error('Failed to fetch validations:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchValidations();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedId && !loading) {
      const timeout = setTimeout(() => {
        const el = document.getElementById(`validation-item-${selectedId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [selectedId, loading, viewMode, validations]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PASS': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'FAIL': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'PARKED': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-white/20 bg-white/5 border-white/10';
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      // Default timestamp sort to DESC (most recent first)
      setSortOrder(field === 'timestamp' ? 'DESC' : 'ASC');
    }
  };

  const sortedValidations = useMemo(() => {
    if (!validations || !Array.isArray(validations)) return [];
    
    let filtered = [...validations];
    filtered = filtered.filter(v => statusFilters.includes(v.status as any));
    
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') comparison = a.title.localeCompare(b.title);
      else if (sortField === 'timestamp') {
        comparison = a.lastUpdated.localeCompare(b.lastUpdated);
        if (comparison === 0) comparison = a.sequence - b.sequence;
      }
      else if (sortField === 'status') comparison = a.status.localeCompare(b.status);
      else if (sortField === 'feature') comparison = a.feature.localeCompare(b.feature);
      else if (sortField === 'sequence') comparison = a.sequence - b.sequence;
      
      return sortOrder === 'ASC' ? comparison : -comparison;
    });
  }, [validations, sortField, sortOrder, statusFilters]);

  const groupedValidations = useMemo(() => {
    const groups: Record<string, Validation[]> = {};
    sortedValidations.forEach(v => {
      if (!groups[v.group]) groups[v.group] = [];
      groups[v.group].push(v);
    });

    // Ensure items within each group are strictly ordered by sequence ASC (natural document checklist order)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.sequence - b.sequence);
    });
    
    // Sort groups themselves based on the current sort field and order
    return Object.entries(groups).sort(([, aItems], [, bItems]) => {
      let comparison = 0;
      
      if (sortField === 'timestamp') {
        const aMax = Math.max(...aItems.map(v => new Date(v.lastUpdated).getTime()));
        const bMax = Math.max(...bItems.map(v => new Date(v.lastUpdated).getTime()));
        comparison = aMax - bMax;
      } else if (sortField === 'sequence') {
        const aMin = Math.min(...aItems.map(v => v.sequence));
        const bMin = Math.min(...bItems.map(v => v.sequence));
        comparison = aMin - bMin;
      } else if (sortField === 'name') {
        comparison = aItems[0].group.localeCompare(bItems[0].group);
      } else {
        // Fallback to first item's sequence
        comparison = aItems[0].sequence - bItems[0].sequence;
      }
      
      return sortOrder === 'ASC' ? comparison : -comparison;
    });
  }, [sortedValidations, sortField, sortOrder]);

  const getDisplayId = (v: Validation) => {
    const match = v.instructions?.match(/VAL-[A-Z0-9-]+/);
    return match ? match[0] : (v.id.split('_').pop()?.substring(0, 8) || '');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const availableIds = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return validations
      .filter(v => !query || getDisplayId(v).toLowerCase().includes(query) || v.id.toLowerCase().includes(query) || v.title.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }, [validations, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Synchronizing Backlog...</span>
      </div>
    );
  }

  const formatElapsedTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };
  const handleStatusUpdate = async (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation();
    try {
      await fetch(`${API_URL}/api/validations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'stillwater-suite' },
        body: JSON.stringify({ status })
      });
      // Optimistic update
      setValidations(prev => prev.map(v => v.id === id ? { ...v, status: status as any } : v));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleGroupStatusUpdate = async (groupItems: Validation[], status: string) => {
    try {
      // Optimistic update
      setValidations(prev => {
        const itemIds = new Set(groupItems.map(i => i.id));
        return prev.map(v => itemIds.has(v.id) ? { ...v, status: status as any } : v);
      });

      // Fire all API requests in parallel
      await Promise.all(groupItems.map(item => 
        fetch(`${API_URL}/api/validations/${item.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'stillwater-suite' },
          body: JSON.stringify({ status })
        })
      ));
    } catch (err) {
      console.error(`Failed to update group status to ${status}:`, err);
    }
  };

  const renderTable = (items: Validation[], showFeature = false) => {
    if (compact) {
      return (
        <div className="space-y-2 px-1">
          {items.map((v) => (
            <motion.div
              id={`validation-item-${v.id}`}
              key={v.id}
              onClick={() => onSelect(v)}
              className={cn(
                "p-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden",
                selectedId === v.id 
                  ? "bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] ring-1 ring-primary/20" 
                  : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span 
                        className="text-[8px] font-black font-mono text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 tracking-tighter"
                        title={`Validation ID: ${getDisplayId(v)}`}
                      >
                        {getDisplayId(v)}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopyValId(v); }}
                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                        title={copiedValId === v.id ? "Copied!" : "Copy Validation ID"}
                      >
                        {copiedValId === v.id ? (
                          <Check className="w-3 h-3 text-green-400 animate-in zoom-in duration-200" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 bg-white/5 opacity-60",
                      v.tag.toLowerCase().includes('suiteutils') ? 'text-primary' :
                      v.tag.toLowerCase().includes('bridge') ? 'text-indigo-400' :
                      v.tag.toLowerCase().includes('persona') ? 'text-amber-400' :
                      'text-white/40'
                    )}>
                      {v.tag}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                    {v.title}
                  </h4>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                    getStatusStyle(v.status)
                  )}>
                    {v.status}
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => handleStatusUpdate(e, v.id, 'PASS')}
                      className="p-1 rounded hover:bg-green-500/20 text-green-500/50 hover:text-green-500 transition-colors"
                      title="Verify Pass"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => handleStatusUpdate(e, v.id, 'FAIL')}
                      className="p-1 rounded hover:bg-red-500/20 text-red-500/50 hover:text-red-500 transition-colors"
                      title="Mark Fail"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span 
                    className="text-[8px] font-mono text-white/60 uppercase"
                    title={`Last Updated: ${new Date(v.lastUpdated).toLocaleString()} (${formatElapsedTime(v.lastUpdated)})`}
                  >
                    {formatElapsedTime(v.lastUpdated)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span 
                    className="text-[8px] font-mono text-white/60 uppercase tracking-widest"
                    title={`Execution Sequence: ${v.sequence}`}
                  >
                    SEQ-{v.sequence}
                  </span>
                  <ArrowRight size={10} className={cn(
                    "transition-all duration-300",
                    selectedId === v.id ? "text-primary translate-x-0" : "text-white/0 -translate-x-2"
                  )} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    return (
      <div className="glass-card overflow-hidden border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest w-24">ID</th>
                {showFeature && (
                  <th 
                    className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                    onClick={() => toggleSort('feature')}
                  >
                    <div className="flex items-center gap-2">
                      Module
                      {sortField === 'feature' && (sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>
                )}
                <th 
                  className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Test Title
                    {sortField === 'name' && (sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors w-32"
                  onClick={() => toggleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortField === 'status' && (sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors w-32"
                  onClick={() => toggleSort('timestamp')}
                >
                  <div className="flex items-center gap-2">
                    Last Update
                    {sortField === 'timestamp' && (sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-right w-32">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((v) => (
                <motion.tr 
                  id={`validation-item-${v.id}`}
                  key={v.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group hover:bg-white/5 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onSelect(v)}
                        className="text-[9px] font-black font-mono text-primary/80 hover:text-primary transition-all bg-primary/5 px-2 py-1 rounded border border-primary/10"
                        title={`Validation ID: ${getDisplayId(v)}`}
                      >
                        {getDisplayId(v)}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopyValId(v); }}
                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                        title={copiedValId === v.id ? "Copied!" : "Copy Validation ID"}
                      >
                        {copiedValId === v.id ? (
                          <Check className="w-3 h-3 text-green-400 animate-in zoom-in duration-200" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>
                  {showFeature && (
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{v.feature}</span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm font-bold">
                      <span className={`font-mono text-[9px] font-black tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase ${
                        v.tag.toLowerCase().includes('suiteutils') ? 'text-primary' :
                        v.tag.toLowerCase().includes('bridge') ? 'text-indigo-400' :
                        v.tag.toLowerCase().includes('persona') ? 'text-amber-400' :
                        v.tag.toLowerCase().includes('sovereign') ? 'text-emerald-400' :
                        'text-primary'
                      }`}>
                        &nbsp;[{v.tag}]&nbsp;
                      </span>
                      <button 
                        onClick={() => onSelect(v)}
                        className={`text-sm font-bold transition-colors text-left ml-2 ${
                          selectedId === v.id ? 'text-primary' : 'text-white/90 hover:text-white'
                        }`}
                      >
                        {v.title}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter border shadow-sm ${getStatusStyle(v.status)}`}>
                        {v.status}
                      </span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => handleStatusUpdate(e, v.id, 'PASS')}
                          className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-500/50 hover:text-green-500 transition-colors"
                          title="Verify Pass"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleStatusUpdate(e, v.id, 'FAIL')}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition-colors"
                          title="Mark Fail"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-white/70">{formatElapsedTime(v.lastUpdated)}</span>
                      <span className="text-[9px] text-white/60 font-mono">
                        {new Date(v.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onSelect(v)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-primary transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Controls */}
      {compact ? (
        <div className="flex flex-col gap-3 px-2 pb-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Backlog</span>
              <span className="text-[10px] font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                {validations.length}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => setViewMode('GROUPED')}
                className={cn(
                  "p-1 rounded-md transition-all",
                  viewMode === 'GROUPED' ? "bg-primary text-black" : "text-white/40 hover:text-white"
                )}
              >
                <LayoutGrid size={12} />
              </button>
              <button 
                onClick={() => setViewMode('STANDARD')}
                className={cn(
                  "p-1 rounded-md transition-all",
                  viewMode === 'STANDARD' ? "bg-primary text-black" : "text-white/40 hover:text-white"
                )}
              >
                <List size={12} />
              </button>
            </div>
          </div>

          <div className="relative z-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                type="text"
                placeholder="Search test ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
            
            <AnimatePresence>
              {isSearchFocused && availableIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl overflow-hidden max-h-[160px] overflow-y-auto custom-scrollbar"
                >
                  {availableIds.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        onSelect(v);
                        setSearchQuery('');
                        setIsSearchFocused(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between group"
                    >
                      <span className="text-[10px] font-black font-mono text-primary/80 group-hover:text-primary transition-colors">
                        {getDisplayId(v)}
                      </span>
                      <span className="text-[9px] font-mono text-white/40 group-hover:text-white/60 transition-colors">
                        {formatElapsedTime(v.lastUpdated)}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Audit Flow</span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => toggleStatusFilter('PENDING')}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all",
                    statusFilters.includes('PENDING') ? "bg-white/10 border-white/20 text-white animate-pulse" : "bg-white/5 border-transparent text-white/40 hover:text-white/60"
                  )}
                >
                  Pending
                </button>
                <button
                  onClick={() => toggleStatusFilter('PASS')}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all",
                    statusFilters.includes('PASS') ? "bg-green-500/20 border-green-500/30 text-green-500 shadow-[0_0_10px_rgba(74,222,128,0.2)]" : "bg-white/5 border-transparent text-white/40 hover:text-green-500/60"
                  )}
                >
                  Pass
                </button>
                <button
                  onClick={() => toggleStatusFilter('FAIL')}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all",
                    statusFilters.includes('FAIL') ? "bg-red-500/20 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(248,113,113,0.2)]" : "bg-white/5 border-transparent text-white/40 hover:text-red-500/60"
                  )}
                >
                  Fail
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleSort('timestamp')}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-widest transition-all",
                  sortField === 'timestamp' ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-white/40"
                )}
                title={sortOrder === 'DESC' ? "Newest First" : "Oldest First"}
              >
                <History size={10} />
                <span>Recent</span>
                {sortField === 'timestamp' && (
                  sortOrder === 'DESC' ? <ArrowDown className="w-2.5 h-2.5 ml-0.5" /> : <ArrowUp className="w-2.5 h-2.5 ml-0.5" />
                )}
              </button>
              <button 
                onClick={fetchValidations}
                className={cn(
                  "p-1.5 rounded-lg bg-white/5 hover:bg-primary/10 text-white/40 hover:text-primary transition-all",
                  isRefreshing && "animate-spin"
                )}
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Validation Backlog</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-primary font-bold">{validations.length} Points Detected</span>
                <span className="text-[10px] text-white/20">•</span>
                <span className="text-[10px] text-white/40 uppercase tracking-tighter">Manual Protocol</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4 bg-black/40 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => toggleStatusFilter('PENDING')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border transition-all",
                  statusFilters.includes('PENDING') ? "bg-white/10 border-white/20 text-white animate-pulse" : "bg-transparent border-transparent text-white/40 hover:text-white/60"
                )}
              >
                Pending
              </button>
              <button
                onClick={() => toggleStatusFilter('PASS')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border transition-all",
                  statusFilters.includes('PASS') ? "bg-green-500/20 border-green-500/30 text-green-500 shadow-[0_0_10px_rgba(74,222,128,0.2)]" : "bg-transparent border-transparent text-white/40 hover:text-green-500/60"
                )}
              >
                Pass
              </button>
              <button
                onClick={() => toggleStatusFilter('FAIL')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border transition-all",
                  statusFilters.includes('FAIL') ? "bg-red-500/20 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(248,113,113,0.2)]" : "bg-transparent border-transparent text-white/40 hover:text-red-500/60"
                )}
              >
                Fail
              </button>
            </div>
            <button 
              onClick={() => toggleSort('timestamp')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all shrink-0",
                sortField === 'timestamp' ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]" : "bg-white/5 border-white/10 text-white/40 hover:text-white"
              )}
              title={sortOrder === 'DESC' ? "Newest First" : "Oldest First"}
            >
              <History size={12} className="shrink-0" />
              <span>Recent</span>
              {sortField === 'timestamp' && (
                sortOrder === 'DESC' ? <ArrowDown className="w-3 h-3 ml-0.5" /> : <ArrowUp className="w-3 h-3 ml-0.5" />
              )}
            </button>

            <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/5 shrink-0">
              <button 
                onClick={() => setViewMode('GROUPED')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'GROUPED' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
                title="Grouped View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('STANDARD')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'STANDARD' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
                title="Standard View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={fetchValidations}
              className={`p-2 rounded-lg bg-white/5 hover:bg-primary/10 text-white/40 hover:text-primary transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content View */}
      <div className="space-y-8">
        {viewMode === 'GROUPED' ? (
          groupedValidations.map(([group, items]) => {
            const isCollapsed = collapsedGroups.has(group);
            const allPass = items.every(item => item.status === 'PASS');
            const anyFail = items.some(item => item.status === 'FAIL');
            const groupStatus = allPass ? 'PASS' : anyFail ? 'FAIL' : 'PENDING';
            return (
            <div key={group} className="space-y-3">
              {/* Premium Group Header Card */}
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
                {/* Row 1: Controls, Indicators, Counts, and Actions */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleGroup(group)}
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors shrink-0"
                      title={isCollapsed ? "Expand Group" : "Collapse Group"}
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ 
                      groupStatus === 'PASS' ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse' : 
                      groupStatus === 'FAIL' ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)] animate-pulse' : 
                      'bg-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                    }`} />
                    <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded shrink-0 border tracking-wider transition-all duration-300 ${ 
                      groupStatus === 'PASS' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                      groupStatus === 'FAIL' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {groupStatus}
                    </span>
                    <span className="text-[10px] font-mono text-white/20 font-bold bg-white/5 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
                      {items.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center shrink-0">
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          handleGroupStatusUpdate(items, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest cursor-pointer outline-none transition-all duration-300"
                    >
                      <option value="" disabled selected hidden>Bulk Actions</option>
                      <option value="PASS" className="bg-[#0A0A0B] text-green-400 font-bold">✓ Verify Pass</option>
                      <option value="FAIL" className="bg-[#0A0A0B] text-red-400 font-bold">✗ Mark Fail</option>
                      <option value="PENDING" className="bg-[#0A0A0B] text-amber-400 font-bold">⟳ Reset Pending</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Title on its own line (full width) */}
                <div className="mt-1 flex items-center justify-center gap-1.5 group/title">
                  <span 
                    className="text-[10px] font-black text-primary hover:text-white uppercase tracking-[0.25em] cursor-pointer transition-colors block leading-relaxed break-words"
                    title={group}
                    onClick={() => toggleGroup(group)}
                  >
                    {group}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyGroup(group);
                    }}
                    className={cn(
                      "p-1 rounded transition-all duration-300 shrink-0",
                      copiedGroup === group
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-white/5 hover:bg-primary/20 text-white/40 hover:text-primary border border-transparent opacity-0 group-hover/title:opacity-100"
                    )}
                    title={copiedGroup === group ? "Copied!" : "Copy Group Title"}
                  >
                    {copiedGroup === group ? (
                      <span className="text-[7px] font-black uppercase tracking-widest px-0.5">Copied!</span>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {renderTable(items)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )})
        ) : (
          renderTable(sortedValidations, viewMode === 'STANDARD')
        )}
      </div>

      {/* Persistence Note */}
      <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <p className="text-[10px] text-primary/60 font-medium uppercase tracking-wider">
          Validation Context is pinned to the sidebar for side-by-side Hive orchestration.
        </p>
      </div>
    </div>
  );
}
