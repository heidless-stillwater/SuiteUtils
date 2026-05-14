'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface DashboardHeroProps {
    audienceMode: 'casual' | 'professional';
    userId: string;
}

export default function DashboardHero({ audienceMode, userId }: DashboardHeroProps) {
    const isPro = audienceMode === 'professional';

    return (
        <div className={cn(
            "mb-8 p-6 rounded-2xl border transition-all duration-500",
            !isPro
                ? "bg-primary/5 border-primary/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]"
                : "bg-accent/5 border-accent/20 shadow-[inset_0_0_20px_rgba(217,70,239,0.05)]"
        )}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-white animate-in slide-in-from-left duration-300",
                            !isPro ? "bg-primary" : "bg-accent"
                        )}>
                            {audienceMode} mode active
                        </span>
                        <h2 className="text-2xl font-bold">
                            {!isPro ? 'Ready to have some fun?' : 'Precision Image Studio'}
                        </h2>
                    </div>
                    <p className="text-foreground-muted max-w-xl leading-relaxed">
                        {!isPro
                            ? 'In Casual mode, we guide you through creating prompts using our Build-a-Prompt tool. It is perfect for fast, high-quality results without the technical jargon.'
                            : 'Professional mode gives you full tool access, granular settings, and a free-form text environment for absolute creative control.'}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link href={`/profile/${userId}`}>
                        <Button variant="secondary" className="w-full sm:w-auto h-12 px-6 gap-2 font-bold transition-all hover:scale-105 active:scale-95">
                            <Icons.user size={18} />
                            <span>Public Profile</span>
                        </Button>
                    </Link>
                    <Link href="/generate">
                        <Button
                            variant={isPro ? 'primary' : 'primary'}
                            className={cn(
                                "w-full sm:w-auto h-12 px-8 text-lg font-bold gap-3 group transition-all hover:scale-105 active:scale-95",
                                isPro && "bg-accent hover:bg-accent-hover shadow-lg shadow-accent/20"
                            )}
                        >
                            <span>{!isPro ? 'Start Creating' : 'New Generation'}</span>
                            <Icons.arrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
