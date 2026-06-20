import React from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Copy, 
  Globe, 
  Trophy, 
  Info,
  Server,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CasualModeViewProps {
  profile: any;
  healthResults: any[];
  loadingAppId: string | null;
  completedIds: string[];
}

export default function CasualModeView({ profile, healthResults, loadingAppId, completedIds }: CasualModeViewProps) {
  const handleTryStyle = (prompt: string) => {
    // In a real implementation, this would navigate to a generator
    console.log('Navigating to generator with prompt:', prompt);
  };

  // Map health results to the ecosystem grid
  const getStatus = (appId: string) => {
    if (appId.toLowerCase() === 'suiteutils') return true;
    const health = healthResults.find(h => h.appId.toLowerCase() === appId.toLowerCase());
    return health?.status === 'UP';
  };

  const apps = [
    { 
      name: 'Stillwater Studio', 
      id: 'suiteutils', 
      icon: <Sparkles className="w-5 h-5" />, 
      desc: 'Orchestration & Command',
      isCurrent: true 
    },
    { 
      name: 'Persona Core', 
      id: 'persona', 
      icon: <Server className="w-5 h-5" />, 
      desc: 'Neural Archetype Engine',
      port: 3005
    },
    { 
      name: 'Master Registry', 
      id: 'promptmasterspa', 
      icon: <ClipboardList className="w-5 h-5" />, 
      desc: 'Production Assets',
      port: 5173
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="space-y-12"
    >
      {/* Guided Welcome */}
      <section className="text-center py-4">
        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">
          What will you create today, <span className="text-primary">{profile?.displayName?.split(' ')[0] || 'Creator'}</span>?
        </h1>
        <p className="text-lg text-white/40 max-w-2xl mx-auto font-medium">
          Your imagination is the only limit. The Stillwater Suite is synchronized and standing by.
        </p>
      </section>

      {/* Ecosystem Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {apps.map((app) => {
          const isActive = getStatus(app.id) || app.isCurrent;
          const cardContent = (
            <div 
              className={`glass-card p-5 group cursor-pointer transition-all duration-500 border-x-0 border-t-0 border-b-2 h-full relative overflow-hidden ${
                app.isCurrent 
                ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/5' 
                : isActive 
                  ? 'border-green-500/30 hover:border-green-500/60 bg-white/5' 
                  : 'border-white/5 hover:border-white/20 opacity-60'
              }`}
            >
              {/* Orchestration Telemetry Overlay (Casual) */}
              {(loadingAppId === app.id || completedIds.includes(app.id)) && (
                <div className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-md flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest animate-pulse">
                      {completedIds.includes(app.id) ? 'STATE CONFIRMED' : 'SYNCHRONIZING'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-transform duration-500 group-hover:scale-110 ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-white/5 text-white/20'
                  }`}>
                    {app.icon}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-white/90">{app.name}</h4>
                    <p className="text-[10px] text-white/30 font-bold">{app.desc}</p>
                  </div>
                </div>
                {isActive ? (
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                    <CheckCircle2 size={12} className="text-green-500" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Lock size={12} className="text-white/20" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-white/10'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isActive ? 'text-green-400' : 'text-white/20'}`}>
                    {app.isCurrent ? 'Active Session' : isActive ? 'System Online' : 'Service Offline'}
                    {app.port && isActive && ` | Port: ${app.port}`}
                  </span>
                </div>
                {!app.isCurrent && isActive && (
                  <ArrowRight size={12} className="text-white/20 group-hover:translate-x-1 transition-transform" />
                )}
              </div>
            </div>
          );

          if (app.id === 'persona') {
            return (
              <Link key={app.id} to="/persona" className="block h-full">
                {cardContent}
              </Link>
            );
          }

          return <div key={app.id}>{cardContent}</div>;
        })}
      </div>

      {/* Starter Prompts */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
            <Sparkles className="text-primary w-5 h-5" />
            Quick Ignition
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Neon Cyberpunk', style: 'Highly detailed, futuristic city, rainy streets, cinematic lighting', color: 'from-purple-500/20 to-blue-500/20' },
            { title: 'Dreamy Watercolor', style: 'Soft edges, pastel colors, whimsical landscape, ethereal atmosphere', color: 'from-pink-500/20 to-yellow-500/20' },
            { title: 'Epic Oil Painting', style: 'Thick brushstrokes, dramatic lighting, classical portrait style', color: 'from-orange-500/20 to-red-500/20' }
          ].map((card, i) => (
            <div
              key={i}
              onClick={() => handleTryStyle(card.style)}
              className={`p-6 glass-card hover:scale-[1.02] transition-all cursor-pointer border-none bg-gradient-to-br ${card.color} group relative overflow-hidden`}
            >
              <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform">
                <ImageIcon size={80} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors text-white">{card.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed mb-4 italic">&quot;{card.style}&quot;</p>
              <div className="w-full py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-center text-[10px] font-black uppercase tracking-widest text-white/60">
                Ignite Style
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Community Engagement */}
      <div className="pt-8 border-t border-white/5">
        <div className="flex flex-wrap gap-4 mb-10">
          <button className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white/5 border border-green-500/20 hover:border-green-500/50 text-white/60 text-xs font-bold transition-all group">
            <Globe size={16} className="group-hover:rotate-12 transition-transform text-green-500" />
            Sovereign Collective
          </button>
          <button className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white/5 border border-yellow-500/20 hover:border-yellow-500/50 text-white/60 text-xs font-bold transition-all group">
            <Trophy size={16} className="group-hover:scale-110 transition-transform text-yellow-500" />
            Hall of Fame
          </button>
        </div>
      </div>

      {/* Tour Invite */}
      <div className="p-6 glass-card bg-primary/5 border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Info size={24} />
          </div>
          <div>
            <p className="font-bold text-white">New to the Sovereign Hive?</p>
            <p className="text-xs text-white/40">Check out the architectural guide to master your orchestration.</p>
          </div>
        </div>
        <button className="px-6 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold transition-all border border-primary/30">
          Initialize Guide
        </button>
      </div>
    </motion.div>
  );
}
