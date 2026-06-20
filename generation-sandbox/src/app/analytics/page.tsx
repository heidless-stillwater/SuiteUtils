'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface AnalyticsStats {
    totalUpvotes: number;
    totalComments: number;
    totalEntries: number;
    totalReach: number;
    totalVariations: number;
    totalReactions: number;
}

interface TagStat {
    tag: string;
    count: number;
    engagement: number;
}

interface ReactionStat {
    emoji: string;
    count: number;
}

interface ChartDataPoint {
    date: string;
    engagement: number;
    entries: number;
}

export default function AnalyticsPage() {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<AnalyticsStats>({
        totalUpvotes: 0,
        totalComments: 0,
        totalEntries: 0,
        totalReach: 0,
        totalVariations: 0,
        totalReactions: 0
    });
    const [entryData, setEntryData] = useState<any[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [tagStats, setTagStats] = useState<TagStat[]>([]);
    const [reactionStats, setReactionStats] = useState<ReactionStat[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'engagement',
        direction: 'desc'
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    useEffect(() => {
        async function fetchAnalytics() {
            if (!user) return;

            try {
                // Fetch all community entries by this user
                const entriesRef = collection(db, 'leagueEntries');
                const q = query(entriesRef, where('originalUserId', '==', user.uid));
                const snapshot = await getDocs(q);

                let upvotes = 0;
                let comments = 0;
                let variations = 0;
                let reactionsCount = 0;

                const tagsMap: Record<string, { count: number, engagement: number }> = {};
                const reactionsMap: Record<string, number> = {};

                const entries = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const entryUpvotes = data.voteCount || 0;
                    const entryComments = data.commentCount || 0;
                    const entryVariations = data.variationCount || 0;
                    const entryEngagement = entryUpvotes + entryComments;

                    upvotes += entryUpvotes;
                    comments += entryComments;
                    variations += entryVariations;

                    // Process reactions
                    if (data.reactions) {
                        Object.entries(data.reactions).forEach(([emoji, users]) => {
                            const count = (users as string[]).length;
                            reactionsCount += count;
                            reactionsMap[emoji] = (reactionsMap[emoji] || 0) + count;
                        });
                    }

                    // Process tags
                    if (data.tags && Array.isArray(data.tags)) {
                        data.tags.forEach((tag: string) => {
                            if (!tagsMap[tag]) {
                                tagsMap[tag] = { count: 0, engagement: 0 };
                            }
                            tagsMap[tag].count += 1;
                            tagsMap[tag].engagement += entryEngagement;
                        });
                    }

                    return { id: doc.id, ...data } as any;
                });

                // Convert maps to arrays and sort
                const processedTags = Object.entries(tagsMap)
                    .map(([tag, stat]) => ({ tag, ...stat }))
                    .sort((a, b) => b.engagement - a.engagement)
                    .slice(0, 10);

                const processedReactions = Object.entries(reactionsMap)
                    .map(([emoji, count]) => ({ emoji, count }))
                    .sort((a, b) => b.count - a.count);

                // Process time-series data for the last 30 days
                const last30Days = [...Array(30)].map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    return d.toISOString().split('T')[0];
                }).reverse();

                const statsByDate = last30Days.reduce((acc, date) => {
                    acc[date] = {
                        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        engagement: 0,
                        entries: 0
                    };
                    return acc;
                }, {} as any);

                entries.forEach(entry => {
                    const date = new Date(entry.publishedAt?.toDate ? entry.publishedAt.toDate() : entry.publishedAt)
                        .toISOString().split('T')[0];
                    if (statsByDate[date]) {
                        statsByDate[date].engagement += (entry.voteCount || 0) + (entry.commentCount || 0);
                        statsByDate[date].entries += 1;
                    }
                });

                // Sort by performance
                entries.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

                setStats({
                    totalUpvotes: upvotes,
                    totalComments: comments,
                    totalEntries: snapshot.size,
                    totalReach: upvotes + comments,
                    totalVariations: variations,
                    totalReactions: reactionsCount
                });
                setEntryData(entries);
                setChartData(Object.values(statsByDate));
                setTagStats(processedTags);
                setReactionStats(processedReactions);

            } catch (error) {
                console.error('Failed to fetch analytics:', error);
            } finally {
                setIsFetching(false);
            }
        }

        if (user) {
            fetchAnalytics();
        }
    }, [user]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const sortedEntries = [...entryData].sort((a, b) => {
        const { key, direction } = sortConfig;

        let valA: any;
        let valB: any;

        if (key === 'engagement') {
            valA = (a.voteCount || 0) + (a.commentCount || 0);
            valB = (b.voteCount || 0) + (b.commentCount || 0);
        } else if (key === 'publishedAt') {
            valA = a.publishedAt?.toDate ? a.publishedAt.toDate().getTime() : new Date(a.publishedAt).getTime();
            valB = b.publishedAt?.toDate ? b.publishedAt.toDate().getTime() : new Date(b.publishedAt).getTime();
        } else if (key === 'prompt') {
            valA = (a[key] || '').toString();
            valB = (b[key] || '').toString();
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            valA = Number(a[key] || 0);
            valB = Number(b[key] || 0);
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIndicator = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <span className="ml-1 opacity-20 text-[10px]">↕</span>;
        return <span className="ml-1 text-primary text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    if (loading || isFetching) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || !profile) return null;


    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <Card variant="glass" className="sticky top-0 z-50 rounded-none border-x-0 border-t-0 border-b border-border">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push('/dashboard')}
                            className="hover:bg-background-secondary rounded-xl"
                        >
                            <Icons.arrowLeft size={20} />
                        </Button>
                        <h1 className="text-xl font-bold">Creator Analytics</h1>
                    </div>
                </div>
            </Card>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
                    <Card className="bg-primary/5 border-primary/20 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Total Reach</p>
                        <p className="text-3xl font-black">{stats.totalReach}</p>
                        <p className="text-[10px] text-foreground-muted mt-1">Total interactions</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Upvotes</p>
                        <p className="text-3xl font-black">❤️ {stats.totalUpvotes}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Comments</p>
                        <p className="text-3xl font-black">💬 {stats.totalComments}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Variations</p>
                        <p className="text-3xl font-black">🌱 {stats.totalVariations}</p>
                        <p className="text-[10px] text-foreground-muted mt-1">Sparked by you</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Reactions</p>
                        <p className="text-3xl font-black">✨ {stats.totalReactions}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Entries</p>
                        <p className="text-3xl font-black">🏆 {stats.totalEntries}</p>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    {/* Visualizations - Main Chart */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Engagement Trends</h2>
                            <span className="text-xs text-foreground-muted font-medium">Last 30 days</span>
                        </div>
                        <Card variant="glass" className="h-[350px] pt-8 pb-4 pr-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            fontSize: '12px'
                                        }}
                                        itemStyle={{ color: '#ec4899', fontWeight: 'bold' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="engagement"
                                        stroke="#ec4899"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorEngage)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Card>
                    </div>

                    {/* Side Stats - Tags & Reactions */}
                    <div className="space-y-8">
                        {/* Top Tags */}
                        <div>
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Icons.tag size={18} className="text-primary" />
                                Top Tags
                            </h2>
                            <Card className="space-y-4 p-6">
                                {tagStats.length === 0 ? (
                                    <p className="text-xs text-foreground-muted text-center py-4 italic">No tags used yet</p>
                                ) : (
                                    tagStats.map((stat, i) => {
                                        const maxEngage = Math.max(...tagStats.map(t => t.engagement)) || 1;
                                        const width = (stat.engagement / maxEngage) * 100;
                                        return (
                                            <div key={stat.tag} className="space-y-1">
                                                <div className="flex justify-between text-[11px] font-bold">
                                                    <span className="text-foreground/80 lowercase">#{stat.tag}</span>
                                                    <span className="text-primary">{stat.engagement} pts</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-background-tertiary rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all duration-1000"
                                                        style={{ width: `${width}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </Card>
                        </div>

                        {/* Reaction Distribution */}
                        <div>
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Icons.heart size={18} className="text-accent" />
                                Community Love
                            </h2>
                            <Card className="p-6">
                                {reactionStats.length === 0 ? (
                                    <p className="text-xs text-foreground-muted text-center py-4 italic">No reactions received</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {reactionStats.map((stat) => (
                                            <div
                                                key={stat.emoji}
                                                className="bg-background-secondary border border-border/50 px-3 py-2 rounded-xl flex items-center gap-2 hover:border-primary/30 transition-colors group"
                                            >
                                                <span className="text-xl group-hover:scale-125 transition-transform">{stat.emoji}</span>
                                                <span className="font-bold text-sm">{stat.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                </div>


                {/* Content Performance */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">Content Performance</h2>
                        <span className="text-sm text-foreground-muted font-medium">
                            Sorted by {sortConfig.key === 'engagement' ? 'engagement' :
                                sortConfig.key === 'voteCount' ? 'upvotes' :
                                    sortConfig.key === 'commentCount' ? 'comments' :
                                        sortConfig.key === 'prompt' ? 'prompt' : 'date'} ({sortConfig.direction})
                        </span>
                    </div>

                    {entryData.length === 0 ? (
                        <Card className="text-center py-20 grayscale opacity-50">
                            <div className="text-6xl mb-4">📉</div>
                            <h3 className="text-xl font-bold mb-2">No data yet</h3>
                            <p className="text-foreground-muted mb-6">Publish images to the Community Hub to start seeing analytics!</p>
                            <Button onClick={() => router.push('/community')}>Visit Community Hub</Button>
                        </Card>
                    ) : (
                        <Card variant="glass" className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border bg-background-secondary/50">
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider w-20">Preview</th>
                                            <th
                                                className="px-6 py-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors group"
                                                onClick={() => handleSort('prompt')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Prompt <SortIndicator columnKey="prompt" />
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-white/5 transition-colors group"
                                                onClick={() => handleSort('publishedAt')}
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    Published <SortIndicator columnKey="publishedAt" />
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-white/5 transition-colors group"
                                                onClick={() => handleSort('voteCount')}
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    Upvotes <SortIndicator columnKey="voteCount" />
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-white/5 transition-colors group"
                                                onClick={() => handleSort('commentCount')}
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    Comments <SortIndicator columnKey="commentCount" />
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-white/5 transition-colors group"
                                                onClick={() => handleSort('engagement')}
                                            >
                                                <div className="flex items-center justify-end gap-2">
                                                    Engagement <SortIndicator columnKey="engagement" />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {sortedEntries.map((entry) => {
                                            const engagement = (entry.voteCount || 0) + (entry.commentCount || 0);
                                            const maxEngagement = stats.totalReach || 1;
                                            const barWidth = Math.max(5, (engagement / maxEngagement) * 100);
                                            const pubDate = new Date(entry.publishedAt?.toDate ? entry.publishedAt.toDate() : entry.publishedAt);

                                            return (
                                                <tr key={entry.id} className="hover:bg-primary/5 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="w-16 h-10 rounded-lg overflow-hidden border border-border group-hover:scale-110 transition-transform bg-background-tertiary">
                                                            {(() => {
                                                                const isVid = !!(entry.videoUrl || entry.settings?.modality === 'video');
                                                                if (isVid) {
                                                                    return <video src={entry.videoUrl || entry.imageUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />;
                                                                }
                                                                return <img src={entry.imageUrl} alt="" className="w-full h-full object-cover" />;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm font-medium line-clamp-1 max-w-[200px]" title={entry.prompt}>{entry.prompt}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs text-foreground-muted font-bold whitespace-nowrap">
                                                            {pubDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-lg">
                                                        {entry.voteCount || 0}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-lg">
                                                        {entry.commentCount || 0}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <div className="hidden sm:flex flex-1 max-w-[80px] h-1.5 bg-background-tertiary rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary rounded-full"
                                                                    style={{ width: `${barWidth}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-lg font-black w-8 text-right">{engagement}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </section>
            </main>
        </div>
    );
}
