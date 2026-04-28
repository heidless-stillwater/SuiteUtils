import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Layers } from 'lucide-react';
import { useSuite } from '../../contexts/SuiteContext';

export function SuiteSwitcher() {
  const { currentSuite, suites, switchSuite, createSuite } = useSuite();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createSuite(newName.trim());
    switchSuite(id);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  const appCount = currentSuite ? Object.keys(currentSuite.apps).length : 0;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all duration-200 group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(13,148,136,0.2)]">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-white/90 truncate">
            {currentSuite?.name || 'Select Suite'}
          </p>
          <p className="text-[10px] text-white/30 font-medium">
            {appCount} app{appCount !== 1 ? 's' : ''} • Operations Hub
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/20 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden animate-fade-in"
          style={{
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="p-2">
            <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
              Your Suites
            </p>
            {suites.map((suite) => (
              <button
                key={suite.id}
                onClick={() => {
                  switchSuite(suite.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 text-left ${
                  suite.id === currentSuite?.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    suite.id === currentSuite?.id
                      ? 'bg-primary/20 text-primary'
                      : 'bg-white/5 text-white/40'
                  }`}
                >
                  {suite.name[0]}
                </div>
                <span className="text-sm font-medium truncate">{suite.name}</span>
                {suite.id === currentSuite?.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-white/5 p-2">
            {creating ? (
              <div className="flex gap-2 px-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Suite name..."
                  className="flex-1 h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-primary/50"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  className="px-3 h-9 bg-primary/20 text-primary rounded-xl text-sm font-bold hover:bg-primary/30 transition-colors"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/30 hover:bg-white/5 hover:text-white/50 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Create New Suite</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
