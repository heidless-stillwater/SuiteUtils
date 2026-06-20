'use client';

import React from 'react';

/**
 * SovereignAlert - A non-intrusive advisory notification for AMBER drifts.
 */
export function SovereignAlert({ message, policySlug }: { message: string; policySlug?: string }) {
  const [isVisible, setIsVisible] = React.useState(true);
  const hubUrl = policySlug 
    ? `http://localhost:3003/policies/${policySlug}` 
    : 'http://localhost:3003';

  if (!isVisible) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9998] w-full max-w-xl animate-in slide-in-from-top duration-700 px-4">
      <div className="bg-black/80 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-[0_0_40px_rgba(245,158,11,0.15)] overflow-hidden relative group">
        <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500/30 w-full" />
        <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 w-1/3 animate-pulse" />

        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-500 shrink-0">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Sovereign_Advisory</span>
              <span className="w-1 h-1 rounded-full bg-amber-500/30" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none font-mono">Status: Drift_Detected</span>
            </div>
            <p className="text-xs text-white/80 font-medium truncate pr-4">{message}</p>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={hubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              Remediate
            </a>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-2 text-white/20 hover:text-white transition-colors"
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
