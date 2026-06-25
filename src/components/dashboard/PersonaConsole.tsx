import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, 
  Sparkles, 
  Shield, 
  Terminal, 
  Activity, 
  MessageSquare, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Zap,
  Target
} from 'lucide-react';
import { API_URL } from '../../lib/api-config';
import { personaLink } from '../../lib/persona';
import type { PersonaProfile } from '../../lib/persona';
import { useSuite } from '../../contexts/SuiteContext';

export default function PersonaConsole() {
  const [archetypes, setArchetypes] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [observations, setObservations] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchObservations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/persona/archetypes`);
      if (!res.ok) throw new Error('Neural Core unreachable');
      const data = await res.json();
      setArchetypes(data);
      if (data.length > 0) setSelectedId(data[0].id);
      await fetchObservations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchObservations = async () => {
    try {
      const res = await fetch('http://localhost:5005/observations');
      if (res.ok) {
        const data = await res.json();
        setObservations(data);
      }
    } catch (e) {}
  };

  const selectedArch = archetypes.find(a => a.id === selectedId);

  const handleSave = async (updatedArch: any) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/persona/archetypes/${updatedArch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedArch)
      });
      if (!res.ok) throw new Error('Sync failed');
      
      setArchetypes(prev => prev.map(a => a.id === updatedArch.id ? updatedArch : a));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">Syncing Neural Core</p>
          <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Establishing Sovereign Protocol</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 page-enter">
      {/* Neural Core Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-8 relative overflow-hidden bg-primary/5 border-primary/20">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Cpu className="w-64 h-64" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]">
                <Cpu className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] block mb-1">Intelligence Core</span>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Sovereign Dashboard</h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Neural Sync Active</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Port 5005 Stream</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 bg-orange-500/5 border-orange-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-orange-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Neural Ingestion</h3>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wide">
              Monitoring real-time behavioral insights from the bridge. Promoting observations hardens the archetype constitution.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-[10px] font-mono text-orange-400/60 uppercase">{observations.length} Pending Insights</span>
            <Target className="w-4 h-4 text-orange-400 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Archetype Selector Sidebar */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="premium-label px-2">Active Archetypes</div>
          <div className="grid grid-cols-1 gap-2">
            {archetypes.map(arch => (
              <button
                key={arch.id}
                onClick={() => setSelectedId(arch.id)}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                  selectedId === arch.id
                    ? 'bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedId === arch.id ? 'bg-primary text-white' : 'bg-white/5 text-white/20'}`}>
                   {arch.archetype === 'Architect' ? <Cpu className="w-4 h-4" /> :
                    arch.archetype === 'Hacker' ? <Terminal className="w-4 h-4" /> :
                    arch.archetype === 'Creative' ? <Sparkles className="w-4 h-4" /> :
                    <Shield className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className={`text-[11px] font-black uppercase tracking-widest ${selectedId === arch.id ? 'text-white' : 'text-white/40'}`}>
                    {arch.archetype}
                  </h4>
                  <p className="text-[8px] font-mono text-white/20 uppercase mt-0.5">{arch.expertise.split(',')[0]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Interface: Insights & Directives */}
        <div className="col-span-12 lg:col-span-9 space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Observation Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Pending Ingestion Feed</h3>
                  <button onClick={fetchObservations} className="p-1.5 text-white/20 hover:text-white transition-colors">
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {observations.length === 0 ? (
                    <div className="p-8 text-center glass-card border-dashed border-white/10">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Neural Buffer Empty</p>
                    </div>
                  ) : (
                    observations.map(obs => (
                      <div key={obs.id} className="p-4 glass-card-static flex items-center justify-between group hover:border-orange-500/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs text-white/80 font-bold">{obs.content || obs.type}</p>
                            <p className="text-[9px] text-white/20 font-mono mt-0.5 uppercase">{obs.timestamp}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (!selectedArch) return;
                            const updated = { ...selectedArch, principles: [...selectedArch.principles, obs.content] };
                            handleSave(updated);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase tracking-widest border border-orange-500/20 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Promote to Principle
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Active Principles Quick-View */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Neural Constitution</h3>
                  <div className="flex items-center gap-4">
                    {saving && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                    <span className="text-[10px] font-mono text-primary uppercase">{selectedArch?.principles?.length || 0} Principles Active</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedArch?.principles?.slice(0, 4).map((p: any, i: number) => (
                    <div key={i} className="p-4 glass-card bg-white/5 border-white/10 group hover:border-primary/30 transition-all">
                      <div className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5" />
                        <p className="text-[11px] text-white/60 leading-relaxed font-medium italic">
                          "{typeof p === 'string' ? p : p.content}"
                        </p>
                      </div>
                    </div>
                  ))}
                  <div 
                    onClick={() => window.location.href = '/persona'}
                    className="p-4 glass-card bg-primary/5 border-primary/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-primary/10 transition-all group border-dashed"
                  >
                    <ExternalLink className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Open Full Manager</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Success/Error Toasts */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed bottom-12 right-12 z-[200]"
          >
            <div className="flex items-center gap-5 px-8 py-6 rounded-3xl bg-background-secondary/95 border border-green-500/40 backdrop-blur-3xl shadow-[0_0_60px_rgba(34,197,94,0.3)]">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <p className="text-base font-black text-white uppercase tracking-tighter italic">Neural Core Updated</p>
                <p className="text-[10px] text-green-400/60 font-black uppercase tracking-[0.3em]">Hardening Synapse Integrity</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
