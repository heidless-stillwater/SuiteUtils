'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MiniStats {
    recentEngagement: { date: string; value: number }[];
    topEntry: { id: string; prompt: string; imageUrl: string; score: number } | null;
    totalReach: number;
}

export default function MiniAnalytics({ userId }: { userId: string }) {
    const [stats, setStats] = useState<MiniStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMiniStats() {
            try {
                const entriesRef = collection(db, 'leagueEntries');
                const q = query(
                    entriesRef,
                    where('originalUserId', '==', userId),
                    orderBy('publishedAt', 'desc'),
                    limit(10)
                );
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setStats({ recentEngagement: [], topEntry: null, totalReach: 0 });
                    return;
                }

                let totalReach = 0;
                let topEntry: MiniStats['topEntry'] = null;
                const trend: { date: string; value: number }[] = [];

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const score = (data.voteCount || 0) + (data.commentCount || 0);
                    totalReach += score;

                    if (!topEntry || score > topEntry.score) {
                        topEntry = {
                            id: doc.id,
                            prompt: data.prompt,
                            imageUrl: data.imageUrl,
                            score
                        };
                    }

                    const date = new Date(data.publishedAt?.toDate ? data.publishedAt.toDate() : data.publishedAt)
                        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                    trend.push({ date, value: score });
                });

                setStats({
                    recentEngagement: trend.reverse(),
                    topEntry,
                    totalReach
                });
            } catch (err) {
                console.error('Error fetching mini stats:', err);
            } finally {
                setLoading(false);
            }
        }

        if (userId) fetchMiniStats();
    }, [userId]);

    if (loading || !stats || (stats.recentEngagement.length === 0 && !stats.topEntry)) {
        return null;
    }

    return (
        <Card variant="glass" className="p-4 bg-primary/5 border-primary/10 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Icons.activity size={12} />
                    Engagement Pulse
                </h3>
                <span className="text-[10px] font-bold text-foreground-muted">Last 10 entries</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Trend Chart */}
                <div className="h-16 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.recentEngagement}>
                            <defs>
                                <linearGradient id="miniColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#818cf8"
                                fillOpacity={1}
                                fill="url(#miniColor)"
                                strokeWidth={2}
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-[9px] font-bold text-center mt-1 text-foreground-muted uppercase tracking-tighter">Velocity</p>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-col justify-center">
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black">{stats.totalReach}</span>
                        <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-tighter">Impact</span>
                    </div>
                    {stats.topEntry && (
                        <div className="mt-2 flex items-center gap-2 bg-background-secondary/50 p-1.5 rounded-lg border border-border/40">
                            <img src={stats.topEntry.imageUrl} className="w-6 h-6 rounded object-cover" alt="" />
                            <div className="overflow-hidden">
                                <p className="text-[8px] font-black uppercase tracking-widest text-primary leading-none">Best Performer</p>
                                <p className="text-[9px] font-bold text-foreground-muted truncate max-w-[60px]">{stats.topEntry.score} pts</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
