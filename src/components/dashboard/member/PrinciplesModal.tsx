import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Trash2, 
  Clock, 
  Save, 
  Loader2, 
  Shield, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Principle {
  content: string;
  updatedAt: string;
}

interface PrinciplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  principles: any[]; // Can be string[] or Principle[]
  onSave: (newPrinciples: Principle[]) => Promise<void>;
  archetypeName: string;
}

export default function PrinciplesModal({ 
  isOpen, 
  onClose, 
  principles, 
  onSave,
  archetypeName 
}: PrinciplesModalProps) {
  const [localPrinciples, setLocalPrinciples] = useState<Principle[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Transform legacy strings to objects on open and sort by recency
  useEffect(() => {
    if (isOpen) {
      console.log('🧠 [Neural Explorer] Ingesting Principles:', principles);
      const transformed = principles.map(p => {
        if (typeof p === 'string') {
          return { content: p, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      
      // Sort: Most recent first
      const sorted = [...transformed].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      console.log('🧠 [Neural Explorer] Sorted List:', sorted);
      setLocalPrinciples(sorted);
      if (sorted.length > 0) setSelectedIndex(0);
    }
  }, [isOpen, principles]);

  const handleUpdate = (index: number, content: string) => {
    const next = [...localPrinciples];
    next[index] = { ...next[index], content, updatedAt: new Date().toISOString() };
    setLocalPrinciples(next);
  };

  const handleAdd = () => {
    const newPrinciple = { 
      content: 'Enter new operating principle...', 
      updatedAt: new Date().toISOString() 
    };
    setLocalPrinciples([newPrinciple, ...localPrinciples]);
    setSelectedIndex(0);
  };

  const handleRemove = (index: number) => {
    const next = localPrinciples.filter((_, i) => i !== index);
    setLocalPrinciples(next);
    if (selectedIndex === index) setSelectedIndex(next.length > 0 ? 0 : null);
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
  };

  const handleCommit = async () => {
    setSaving(true);
    try {
      await onSave(localPrinciples);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-card w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl border-primary/20 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Operating Principles Explorer</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-mono">{archetypeName} :: Neural Directive Editor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCommit}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-black uppercase tracking-widest transition-all border border-primary/40 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Commit Principles
            </button>
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Explorer List */}
          <div className="w-full md:w-80 border-r border-white/10 overflow-y-auto bg-black/20 p-4 space-y-3">
            <div className="flex items-center justify-between px-2 mb-4">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Active Instructions</span>
              <button 
                onClick={handleAdd}
                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {localPrinciples.map((p, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                      selectedIndex === i 
                        ? 'bg-primary/10 border-primary/40 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedIndex(i)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate mb-2 ${selectedIndex === i ? 'text-white' : 'text-white/60'}`}>
                          {p.content}
                        </p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-white/20" />
                          <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">
                            Updated {formatDistanceToNow(new Date(p.updatedAt))} ago
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Focused Editor */}
          <div className="flex-1 p-8 overflow-y-auto bg-black/40">
            {selectedIndex !== null ? (
              <motion.div
                key={selectedIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                <div className="flex items-center gap-4 text-primary mb-8">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-[14px] font-black border border-primary/20">
                    {selectedIndex + 1}
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-tight">Focusing Neural Instruction</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Instruction Payload</label>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-white/20 uppercase">
                      <Sparkles className="w-3 h-3" />
                      Neural Ingestion Active
                    </div>
                  </div>
                  <textarea
                    value={localPrinciples[selectedIndex].content}
                    onChange={(e) => handleUpdate(selectedIndex, e.target.value)}
                    className="w-full h-[400px] bg-black/60 border-white/10 rounded-3xl p-8 text-lg font-medium text-white/80 focus:ring-primary/40 transition-all border shadow-inner leading-relaxed"
                    placeholder="Enter the operating principle..."
                  />
                  <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-white/20" />
                      <div>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Last Modified State</p>
                        <p className="text-[11px] text-white/60 font-mono">{new Date(localPrinciples[selectedIndex].updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/20 font-mono">
                      CRC: {Math.random().toString(36).substring(7).toUpperCase()}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/10">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white/20 uppercase tracking-tighter">No Instruction Selected</h3>
                <p className="text-sm text-white/10 max-w-xs">Select a principle from the explorer to begin editing the neural directive.</p>
                <button onClick={handleAdd} className="btn-primary mt-4">Generate New Principle</button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
