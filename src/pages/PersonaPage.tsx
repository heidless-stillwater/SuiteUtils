import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, 
  Sparkles, 
  Shield, 
  Terminal, 
  Activity, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Zap,
  Target,
  ExternalLink,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { API_URL } from '../lib/api-config';
import PrinciplesModal from '../components/dashboard/member/PrinciplesModal';
import SovereignNeuralChat from '../components/dashboard/member/SovereignNeuralChat';

interface Principle {
  content: string;
  updatedAt: string;
}

interface Archetype {
  id: string;
  name: string;
  expertise: string;
  communicationStyle: string;
  principles: (string | Principle)[];
  skills: string[];
  archetype: string;
  lastSyncAt: string;
}

export function PersonaPage() {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [observations, setObservations] = useState<any[]>([]);
  const [isPrinciplesModalOpen, setIsPrinciplesModalOpen] = useState(false);

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
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
      await fetchObservations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchObservations = async () => {
    try {
      const res = await fetch('http://localhost:3008/observations');
      if (res.ok) {
        const data = await res.json();
        setObservations(data);
      }
    } catch (e) {
      // Bridge likely offline, fail silently for autonomous feel
    }
  };

  const selectedArch = archetypes.find(a => a.id === selectedId);

  const handleSave = async (updatedArch: Archetype) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/persona/archetypes/${updatedArch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedArch)
      });
      if (!res.ok) throw new Error('Neural Sync failed');
      
      setArchetypes(prev => prev.map(a => a.id === updatedArch.id ? updatedArch : a));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrinciples = async (newPrinciples: Principle[]) => {
    if (!selectedArch) return;
    const updated = { ...selectedArch, principles: newPrinciples };
    await handleSave(updated);
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
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Sovereign Persona</h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Neural Sync Active</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Port 3008 Stream</span>
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
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                  selectedId === arch.id
                    ? 'bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className={`p-2 rounded-lg transition-all ${selectedId === arch.id ? 'bg-primary text-white scale-110' : 'bg-white/5 text-white/20'}`}>
                   {arch.archetype === 'Architect' ? <Cpu className="w-4 h-4" /> :
                    arch.archetype === 'Hacker' ? <Terminal className="w-4 h-4" /> :
                    arch.archetype === 'Creative' ? <Sparkles className="w-4 h-4" /> :
                    arch.archetype === 'Guardian' ? <Shield className="w-4 h-4" /> :
                    <Cpu className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <h4 className={`text-[11px] font-black uppercase tracking-widest ${selectedId === arch.id ? 'text-white' : 'text-white/40'}`}>
                    {arch.archetype}
                  </h4>
                  <p className="text-[8px] font-mono text-white/20 uppercase mt-0.5">{arch.expertise?.split(',')[0] || ''}</p>
                </div>
                {selectedId === arch.id && <ChevronRight className="w-4 h-4 text-primary" />}
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
              className="space-y-8"
            >
              {/* Observation Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Pending Ingestion Feed</h3>
                  <button onClick={fetchObservations} className="p-1.5 text-white/20 hover:text-white transition-colors">
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {observations.length === 0 ? (
                    <div className="p-8 text-center glass-card border-dashed border-white/10">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Neural Buffer Empty</p>
                    </div>
                  ) : (
                    observations.map((obs, idx) => (
                      <div key={idx} className="p-4 glass-card-static flex items-center justify-between group hover:border-orange-500/30 transition-all">
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

              {/* Operating Principles Deep-Link */}
              <div 
                onClick={() => setIsPrinciplesModalOpen(true)}
                className="group glass-card p-6 border-primary/20 bg-primary/5 hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Shield className="w-24 h-24 text-primary" />
                </div>
                
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter group-hover:text-primary transition-colors">Neural Constitution</h3>
                      <p className="text-xs text-white/30">Explore and edit the full registry of operating principles.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 group-hover:bg-primary/20 transition-all">
                    {selectedArch?.principles?.length || 0} Principles Active
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Communication Style Editor */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Neural Tone & Behavior</h3>
                </div>
                
                <div className="glass-card p-6">
                  <textarea
                    value={selectedArch?.communicationStyle || ''}
                    onChange={(e) => {
                      if (!selectedArch) return;
                      const updated = { ...selectedArch, communicationStyle: e.target.value };
                      setArchetypes(prev => prev.map(a => a.id === updated.id ? updated : a));
                    }}
                    onBlur={() => selectedArch && handleSave(selectedArch)}
                    className="w-full bg-black/40 border-white/10 rounded-2xl text-sm font-mono text-white/70 py-4 px-6 focus:ring-primary/40 transition-all min-h-[250px]"
                    placeholder="[TONE]: ...\n[STRUCTURE]: ...\n[BEHAVIOR]: ..."
                  />
                  <p className="text-[10px] text-white/20 mt-4 px-2 uppercase tracking-[0.2em]">
                    Real-time behavior updates are synced to the local bridge upon focus loss.
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Neural Modals */}
      <PrinciplesModal 
        isOpen={isPrinciplesModalOpen}
        onClose={() => setIsPrinciplesModalOpen(false)}
        principles={selectedArch?.principles || []}
        archetypeName={selectedArch?.archetype || 'Neural'}
        onSave={handleSavePrinciples}
      />

      {/* Status Toasts */}
      <AnimatePresence>
        {(success || saving) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 right-10 z-[200]"
          >
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
              saving ? 'bg-primary/20 border-primary/40' : 'bg-green-500/20 border-green-500/40'
            }`}>
              {saving ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">{saving ? 'Neural Syncing...' : 'Sync Successful'}</p>
                <p className={`text-[10px] font-mono uppercase ${saving ? 'text-primary/60' : 'text-green-400/60'}`}>
                  {saving ? 'UPDATING CORE DIRECTIVES' : 'CONSTITUTION HARDENED'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SovereignNeuralChat />
    </div>
  );
}
