import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Shield, 
  Terminal, 
  Cpu, 
  Sparkles, 
  Search, 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { API_URL } from '../lib/api-config';
import { useSuite } from '../contexts/SuiteContext';

interface Archetype {
  id: string;
  name: string;
  expertise: string;
  communicationStyle: string;
  principles: string[];
  skills: string[];
  archetype: string;
  lastSyncAt: string;
}

export function PersonaPage() {
  const { currentSuite } = useSuite();
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Editing State
  const [editData, setEditData] = useState<Archetype | null>(null);

  useEffect(() => {
    fetchArchetypes();
  }, []);

  const fetchArchetypes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/persona/archetypes`);
      if (!res.ok) throw new Error('Failed to fetch archetypes');
      const data = await res.json();
      setArchetypes(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
        setEditData(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: string) => {
    const arch = archetypes.find(a => a.id === id);
    if (arch) {
      setSelectedId(id);
      setEditData({ ...arch });
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/persona/archetypes/${editData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (!res.ok) throw new Error('Failed to save changes');
      
      setArchetypes(prev => prev.map(a => a.id === editData.id ? editData : a));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updatePrinciple = (index: number, value: string) => {
    if (!editData) return;
    const newPrinciples = [...editData.principles];
    newPrinciples[index] = value;
    setEditData({ ...editData, principles: newPrinciples });
  };

  const addPrinciple = () => {
    if (!editData) return;
    setEditData({ ...editData, principles: [...editData.principles, 'New Operating Principle...'] });
  };

  const removePrinciple = (index: number) => {
    if (!editData) return;
    const newPrinciples = editData.principles.filter((_, i) => i !== index);
    setEditData({ ...editData, principles: newPrinciples });
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <span className="text-[10px] font-bold text-primary tracking-[0.3em] animate-pulse uppercase">Syncing Neural Core...</span>
      </div>
    );
  }

  const activeArchetype = archetypes.find(a => a.id === selectedId);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Sovereign Persona</h1>
          <p className="text-sm text-white/40 mt-1">Manage the Hive's Neural Directives and Operating Principles</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Neural Sync Active</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !editData}
            className="btn-primary py-2.5 px-6 gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Syncing...' : 'Commit Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Sidebar: Archetype Selection */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="premium-label px-2">Sovereign Archetypes</div>
          <div className="space-y-2">
            {archetypes.map((arch) => (
              <button
                key={arch.id}
                onClick={() => handleSelect(arch.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                  selectedId === arch.id
                    ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className={`p-2 rounded-lg transition-all ${
                  selectedId === arch.id ? 'bg-primary text-white scale-110' : 'bg-white/5 text-white/20'
                }`}>
                  {arch.archetype === 'Architect' ? <Cpu className="w-4 h-4" /> :
                   arch.archetype === 'Hacker' ? <Terminal className="w-4 h-4" /> :
                   arch.archetype === 'Creative' ? <Sparkles className="w-4 h-4" /> :
                   arch.archetype === 'Guardian' ? <Shield className="w-4 h-4" /> :
                   <Search className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${
                    selectedId === arch.id ? 'text-white' : 'text-white/40'
                  }`}>{arch.archetype}</h3>
                  <p className="text-[9px] text-white/20 font-mono mt-0.5">ID: {arch.id}</p>
                </div>
                {selectedId === arch.id && <ChevronRight className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Principle Editor */}
        <div className="col-span-12 lg:col-span-9 space-y-8">
          {editData && (
            <motion.div
              key={editData.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              {/* Header Info */}
              <div className="glass-card p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  {editData.archetype === 'Architect' ? <Cpu className="w-48 h-48" /> :
                   editData.archetype === 'Hacker' ? <Terminal className="w-48 h-48" /> :
                   editData.archetype === 'Creative' ? <Sparkles className="w-48 h-48" /> :
                   editData.archetype === 'Guardian' ? <Shield className="w-48 h-48" /> :
                   <Search className="w-48 h-48" />}
                </div>

                <div className="flex flex-col gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]">
                      {editData.archetype === 'Architect' ? <Cpu className="w-8 h-8" /> :
                       editData.archetype === 'Hacker' ? <Terminal className="w-8 h-8" /> :
                       editData.archetype === 'Creative' ? <Sparkles className="w-8 h-8" /> :
                       editData.archetype === 'Guardian' ? <Shield className="w-8 h-8" /> :
                       <Search className="w-8 h-8" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] block mb-1">Archetype Profile</span>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{editData.archetype}</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold ml-1">Expertise Registry</label>
                      <input
                        type="text"
                        value={editData.expertise}
                        onChange={(e) => setEditData({ ...editData, expertise: e.target.value })}
                        className="w-full bg-black/40 border-white/10 rounded-xl text-sm text-white py-3 px-4 focus:ring-primary/40 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold ml-1">Last Neural Sync</label>
                      <div className="w-full bg-white/5 border border-white/5 rounded-xl text-sm text-white/40 py-3 px-4 font-mono">
                        {new Date(editData.lastSyncAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Principles Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">Operating Principles</h3>
                  </div>
                  <button
                    onClick={addPrinciple}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest transition-all border border-primary/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Principle
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <AnimatePresence mode="popLayout">
                    {editData.principles.map((principle, index) => (
                      <motion.div
                        key={`${editData.id}-principle-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all focus-within:border-primary/50"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-white/20 shrink-0 select-none">
                          {index + 1}
                        </div>
                        <textarea
                          value={principle}
                          onChange={(e) => updatePrinciple(index, e.target.value)}
                          className="flex-1 bg-transparent border-none text-sm text-white/80 focus:ring-0 resize-none py-1 min-h-[44px]"
                          rows={Math.max(1, Math.ceil(principle.length / 80))}
                        />
                        <button
                          onClick={() => removePrinciple(index)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all self-start"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Communication Style Editor */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Communication Style (Behavioral)</h3>
                </div>
                
                <div className="glass-card p-6">
                  <textarea
                    value={editData.communicationStyle}
                    onChange={(e) => setEditData({ ...editData, communicationStyle: e.target.value })}
                    className="w-full bg-black/40 border-white/10 rounded-2xl text-sm font-mono text-white/70 py-4 px-6 focus:ring-primary/40 transition-all min-h-[300px]"
                    placeholder="[TONE]: ...\n[STRUCTURE]: ...\n[BEHAVIOR]: ..."
                  />
                  <p className="text-[10px] text-white/20 mt-4 px-2 uppercase tracking-[0.2em]">
                    Use [TONE], [STRUCTURE], and [BEHAVIOR] tags for optimal neural ingestion.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Status Toasts */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 right-10 z-[200]"
          >
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-green-500/20 border border-green-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">Sync Successful</p>
                <p className="text-[10px] text-green-400/60 font-mono">NEURAL CONSTITUTION UPDATED</p>
              </div>
            </div>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 right-10 z-[200]"
          >
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-red-500/20 border border-red-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(239,68,68,0.2)]">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">Sync Failed</p>
                <p className="text-[10px] text-red-400/60 font-mono">{error.toUpperCase()}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
