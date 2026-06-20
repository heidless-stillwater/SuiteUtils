import { useLocation } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSuite } from '../../contexts/SuiteContext';
import { usePersona } from '../../contexts/PersonaContext';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/deploy': 'Deploy Console',
  '/history': 'Deploy History',
  '/themes': 'Theme Studio',
  '/settings': 'Settings',
  '/pricing': 'Pricing',
  '/login': 'Sign In',
};

export function TopBar() {
  const location = useLocation();
  const { profile } = useAuth();
  const { currentSuite } = useSuite();

  const pageLabel = ROUTE_LABELS[location.pathname] || 'Page';

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between h-16 px-8 border-b border-white/5"
      style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/30 font-medium">
          {currentSuite?.name || 'SuiteUtils'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-white/15" />
        <span className="text-white/80 font-semibold">{pageLabel}</span>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Environment Badge */}
        <span className="badge badge-accent">production</span>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>

        {/* User Avatar & Persona */}
        <div className="flex items-center gap-3">
          <PersonaIndicator />
          {profile && (
            <>
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName || ''}
                  className="w-8 h-8 rounded-full border border-white/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {(profile.displayName || profile.email)?.[0]?.toUpperCase()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PersonaIndicator() {
  const { profile, isAligned } = usePersona();
  if (!profile) return null;

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
        isAligned ? 'border-accent/20 bg-accent/5' : 'border-white/5 bg-white/5 opacity-50'
      }`}
      title={isAligned ? 'Synchronized with Persona Hub' : 'Syncing...'}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${isAligned ? 'bg-accent animate-pulse' : 'bg-white/20'}`} />
      <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
        {profile.archetype}
      </span>
    </div>
  );
}
