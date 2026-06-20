import React, { useState } from 'react';
import { Database, Zap, Shield, Search, Terminal, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePersona } from '../contexts/PersonaContext';
import { personaLink } from '../lib/persona';

export function DBAdminPage() {
  const { profile, isAligned } = usePersona();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleExecuteOperation = async (opName: string, type: 'technical' | 'architectural') => {
    setStatus(`Executing ${opName}...`);
    
    // Simulate DB Operation
    setTimeout(async () => {
      setStatus(`Success: ${opName} completed.`);
      
      // REPORT TO PERSONA
      await personaLink.reportDBInsight(
        `Optimized ${opName} in DB Admin context using ${profile?.archetype || 'Standard'} protocol`,
        type
      );

      setTimeout(() => setStatus(null), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">DB Admin Console</h1>
          <p className="text-white/40 text-sm mt-1">Operational Control & Intelligence Sync</p>
        </div>
        
        {isAligned && (
          <div className="flex items-center gap-3 bg-accent/10 border border-accent/20 px-4 py-2 rounded-2xl">
            <Zap className="w-4 h-4 text-accent animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-accent">
              Active Mode: {profile?.archetype}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Operational Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass p-6 rounded-3xl border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <Terminal className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Rapid Command Entry</h2>
            </div>
            
            <div className="relative">
              <textarea 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter SQL or Admin Command..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-accent font-mono text-xs h-32 focus:border-accent/40 outline-none transition-all resize-none"
              />
              <button 
                onClick={() => handleExecuteOperation('Manual Query', 'technical')}
                className="absolute bottom-4 right-4 p-3 bg-accent text-black rounded-xl hover:scale-105 transition-transform"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickAction 
              icon={<Database size={18} />} 
              title="Schema Optimization" 
              desc="Analyze and refactor table indexes"
              onClick={() => handleExecuteOperation('Schema Indexing', 'architectural')}
            />
            <QuickAction 
              icon={<Shield size={18} />} 
              title="Security Audit" 
              desc="Review user permissions and access"
              onClick={() => handleExecuteOperation('Access Audit', 'technical')}
            />
          </div>
        </div>

        {/* Intelligence Context Sidebar */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-3xl border-white/5">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Identity Influence</h3>
            
            {profile ? (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-accent uppercase mb-2">Active Expertise</p>
                  <p className="text-xs text-white/80 font-medium leading-relaxed">{profile.expertise}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-white/20 uppercase">Constraints Applied</p>
                  {profile.principles.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-white/60 font-medium bg-white/5 p-2 rounded-lg">
                      <CheckCircle2 size={10} className="text-accent" />
                      {typeof p === 'string' ? p : (p as any).content}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/10">Connecting to Hub...</p>
              </div>
            )}
          </div>

          {status && (
            <div className="p-4 bg-accent/20 border border-accent/40 rounded-2xl animate-pulse">
              <div className="flex items-center gap-3">
                <Zap size={14} className="text-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{status}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-start gap-4 p-6 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 hover:border-accent/20 transition-all text-left group"
    >
      <div className="p-3 bg-black/40 rounded-2xl text-accent group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-[10px] text-white/40 font-medium leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}
