'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '@/components/ui/Icons';

const apps = [
    { name: 'PlanTune', url: 'http://localhost:3004', icon: Icons.activity, color: 'text-teal-400', desc: 'Credit Strategy Engine' },
    { name: 'PromptMaster', url: 'http://localhost:5173', icon: Icons.zap, color: 'text-amber-400', desc: 'Central Registry' },
    { name: 'PromptTool', url: 'http://localhost:3001', icon: Icons.grid, color: 'text-indigo-400', desc: 'AI Image Studio', current: true },
    { name: 'Resources', url: 'http://localhost:3002', icon: Icons.feed, color: 'text-emerald-400', desc: 'Sovereign Library' },
    { name: 'VideoSystem', url: 'http://localhost:3001', icon: Icons.video, color: 'text-rose-400', desc: 'AI Documentary Engine' },
    { name: 'Accreditation', url: 'http://localhost:3003', icon: Icons.shield, color: 'text-blue-400', desc: 'Compliance Hub' },
];

export function SuiteSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 h-10 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-xl transition-all group shadow-sm active:scale-95"
            >
                <div className="relative">
                    <Icons.grid size={14} className="text-primary group-hover:rotate-90 transition-transform duration-500" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-white hidden sm:block">Suite</span>
                <Icons.chevronDown size={12} className={`text-white/20 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-3 left-0 w-80 bg-[#0f172a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Stillwater Ecosystem</h3>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                        {apps.map((app) => (
                            <a 
                                key={app.name} 
                                href={app.url}
                                className={`flex items-center gap-4 p-3 rounded-xl transition-all group relative overflow-hidden ${
                                    app.current 
                                        ? 'bg-white/[0.05] border border-white/10 ring-1 ring-primary/20' 
                                        : 'hover:bg-white/[0.05] border border-transparent'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110 duration-500 ${app.color}`}>
                                    <app.icon size={20} />
                                </div>
                                <div className="relative z-10">
                                    <div className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        {app.name}
                                        {app.current && <span className="w-1 h-1 rounded-full bg-primary" />}
                                    </div>
                                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-1 group-hover:text-white/50 transition-colors">{app.desc}</div>
                                </div>
                                {app.current && (
                                    <div className="absolute right-4 text-primary opacity-40">
                                        <Icons.check size={14} />
                                    </div>
                                )}
                            </a>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between px-2">
                        <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Sovereign Node v1.2</p>
                        <Icons.shield size={10} className="text-white/10" />
                    </div>
                </div>
            )}
        </div>
    );
}
