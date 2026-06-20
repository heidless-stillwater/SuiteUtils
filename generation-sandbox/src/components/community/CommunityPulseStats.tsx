'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { CommunityEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PulseStats {
    totalInteractions: number;
    topTags: { tag: string; count: number }[];
    totalEntries: number;
    activityLevel: 'low' | 'medium' | 'high';
}

export default function CommunityPulseStats() {
    const [stats, setStats] = useState<PulseStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPulse() {
            try {
                // Fetch latest 50 entries to gauge current pulse
                const entriesRef = collection(db, 'leagueEntries');
                const q = query(entriesRef, orderBy('publishedAt', 'desc'), limit(50));
                const snapshot = await getDocs(q);

                let interactions = 0;
                const tagsMap: Record<string, number> = {};

                snapshot.docs.forEach(doc => {
                    const data = doc.data() as CommunityEntry;
                    interactions += (data.voteCount || 0) + (data.commentCount || 0);

                    if (data.tags) {
                        data.tags.forEach(tag => {
                            tagsMap[tag] = (tagsMap[tag] || 0) + 1;
                        });
                    }
                });

                const topTags = Object.entries(tagsMap)
                    .map(([tag, count]) => ({ tag, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                // Activity level based on interactions in the last 50 entries
                const avgInteractions = interactions / 50;
                const activityLevel = avgInteractions > 10 ? 'high' : avgInteractions > 3 ? 'medium' : 'low';

                setStats({
                    totalInteractions: interactions,
                    topTags,
                    totalEntries: snapshot.size,
                    activityLevel
                });
            } catch (err) {
                console.error('Error fetching community pulse:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchPulse();
    }, []);

    if (loading || !stats) return null;

    return (
        <Card variant="glass" className="mb-8 p-6 border-primary/10 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                <Icons.activity size={120} />
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative z-10">
                {/* Global Glance */}
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-lg",
                            stats.activityLevel === 'high' ? "bg-orange-500/20 border-orange-500/50 text-orange-500 shadow-orange-500/20" :
                                stats.activityLevel === 'medium' ? "bg-primary/20 border-primary/50 text-primary shadow-primary/20" :
                                    "bg-slate-500/20 border-slate-500/50 text-slate-500 shadow-slate-500/20"
                        )}>
                            <Icons.activity size={24} className={cn(stats.activityLevel === 'high' && "animate-pulse")} />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-background border-2 border-border rounded-full flex items-center justify-center">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-ping",
                                stats.activityLevel === 'high' ? "bg-orange-500" :
                                    stats.activityLevel === 'medium' ? "bg-primary" :
                                        "bg-slate-500"
                            )} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground-muted mb-0.5">Live Pulse</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black gradient-text">
                                {stats.totalInteractions}
                            </span>
                            <span className="text-xs font-bold text-foreground-muted">Recent Interactions</span>
                        </div>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden md:block w-px h-12 bg-border/50" />

                {/* Trending Tags */}
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-3 flex items-center gap-2">
                        <Icons.sparkles size={12} className="text-yellow-500" />
                        Community Resonance
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {stats.topTags.map((t, i) => (
                            <div
                                key={t.tag}
                                className="px-3 py-1.5 rounded-xl bg-background-secondary border border-border/50 text-xs font-bold hover:border-primary/40 hover:bg-primary/5 transition-all cursor-default flex items-center gap-2 group/tag"
                            >
                                <span className="text-foreground-muted group-hover/tag:text-primary transition-colors">#</span>
                                {t.tag}
                                <span className="bg-background-tertiary px-1.5 py-0.5 rounded text-[9px] opacity-70">
                                    {t.count}
                                </span>
                            </div>
                        ))}
                        {stats.topTags.length === 0 && (
                            <p className="text-xs text-foreground-muted italic">Charting cosmic dust...</p>
                        )}
                    </div>
                </div>

                {/* Global Scale */}
                <div className="flex flex-col items-end">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Activity Density</p>
                        <p className={cn(
                            "text-lg font-black capitalize",
                            stats.activityLevel === 'high' ? "text-orange-500" :
                                stats.activityLevel === 'medium' ? "text-primary" :
                                    "text-slate-500"
                        )}>
                            {stats.activityLevel} Activity
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
