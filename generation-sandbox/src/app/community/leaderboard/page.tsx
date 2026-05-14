'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export default function LeaderboardPage() {
    const { user: currentUser, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const [topCreators, setTopCreators] = useState<UserProfile[]>([]);
    const [timeframe, setTimeframe] = useState<'all-time' | 'weekly'>('all-time');
    const [loading, setLoading] = useState(true);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchLeaderboard = useCallback(async () => {
        // Don't fetch if auth is still loading to avoid race conditions/premature 403s
        if (authLoading) return;

        try {
            setLoading(true);
            setQueryError(null);
            const usersRef = collection(db, 'users');

            if (timeframe === 'all-time') {
                const q = query(
                    usersRef,
                    orderBy('totalInfluence', 'desc'),
                    limit(50)
                );

                const snapshot = await getDocs(q);
                const creators = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                } as UserProfile));

                setTopCreators(creators.filter(c => (c.totalInfluence || 0) > 0));
            } else {
                // ... rest of the weekly logic remains the same ...
                // Weekly Logic: Query the new 'votes' collection for votes cast in the last 7 days
                const now = new Date();
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const votesRef = collection(db, 'votes');
                const q = query(
                    votesRef,
                    where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(q);

                // Aggregate votes by author
                const authorStats: Record<string, {
                    score: number,
                    name: string,
                    photo: string | null,
                    publishedCount: number
                }> = {};

                // We need to fetch author details for these votes
                const authorIds = new Set<string>();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.authorId) authorIds.add(data.authorId);
                });

                const profilePromises = Array.from(authorIds).map(async (authorId) => {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', authorId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            return {
                                uid: authorId,
                                displayName: userData.displayName || 'Unknown',
                                photoURL: userData.photoURL || null,
                                publishedCount: userData.publishedCount || 0
                            };
                        }
                    } catch (e) {
                        console.error(`[Leaderboard] Error fetching profile for ${authorId}:`, e);
                    }
                    return null;
                });

                const profiles = await Promise.all(profilePromises);
                const profilesMap = new Map(profiles.filter(p => p !== null).map(p => [p!.uid, p!]));

                snapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    const authorId = data.authorId;
                    if (!authorId) return;

                    const authorProfile = profilesMap.get(authorId);
                    if (!authorStats[authorId]) {
                        authorStats[authorId] = {
                            score: 0,
                            name: authorProfile?.displayName || 'Unknown',
                            photo: authorProfile?.photoURL || null,
                            publishedCount: authorProfile?.publishedCount || 0
                        };
                    }
                    if (authorStats[authorId]) {
                        authorStats[authorId].score += 1 * (data.value || 1);
                    }
                });

                const weeklyCreators: UserProfile[] = Object.entries(authorStats)
                    .map(([uid, stats]) => ({
                        uid,
                        displayName: stats.name,
                        photoURL: stats.photo,
                        totalInfluence: stats.score,
                        publishedCount: stats.publishedCount || 0,
                        role: 'member',
                        subscription: 'free',
                        audienceMode: 'casual',
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    } as UserProfile))
                    .sort((a, b) => (b.totalInfluence || 0) - (a.totalInfluence || 0))
                    .slice(0, 50);

                setTopCreators(weeklyCreators);
            }
        } catch (error: any) {
            console.error('[Leaderboard] Error fetching:', error);
            // Include raw error code and message for better debugging
            const detailedError = error.code ? `[${error.code}] ${error.message}` : error.message;
            setQueryError(detailedError);
        } finally {
            setLoading(false);
        }
    }, [timeframe, authLoading]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    const handleMigrate = async () => {
        if (!currentUser || isMigrating) return;

        try {
            setIsMigrating(true);
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/admin/migrate-influence/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Migration failed');

            showToast('Influence scores recalculated successfully!', 'success');
            fetchLeaderboard();
        } catch (error: any) {
            console.error('[Leaderboard] Migration error:', error);
            showToast(error.message || 'Failed to sync stats', 'error');
        } finally {
            setIsMigrating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    const podium = topCreators.slice(0, 3);
    const rest = topCreators.slice(3);

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <Card variant="glass" className="sticky top-0 z-50 rounded-none border-x-0 border-t-0 border-b border-border">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/community" className="text-xl font-bold gradient-text">
                            Community Hub
                        </Link>
                        <span className="text-border">/</span>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-foreground-muted">Hall of Fame</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={() => router.push('/community')} size="sm">
                            <Icons.arrowLeft size={16} className="mr-2" />
                            Back to Gallery
                        </Button>
                    </div>
                </div>
            </Card>

            <main className="max-w-4xl mx-auto px-4 py-12">
                <div className="text-center mb-16 relative">
                    <h2 className="text-5xl font-black mb-4 tracking-tight">Top Creators</h2>
                    <p className="text-foreground-muted text-lg max-w-xl mx-auto">
                        Honoring the most influential prompt engineers in the AI Image Studio community.
                    </p>

                    {/* Timeframe Toggle */}
                    <div className="flex justify-center mt-8">
                        <div className="bg-background-secondary p-1 rounded-xl flex items-center shadow-inner border border-border/50">
                            <button
                                onClick={() => setTimeframe('all-time')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all border-2 ${timeframe === 'all-time'
                                    ? 'bg-primary text-white border-primary shadow-lg'
                                    : 'text-foreground-muted hover:text-foreground border-transparent'
                                    }`}
                            >
                                All Time
                            </button>
                            <button
                                onClick={() => setTimeframe('weekly')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all border-2 ${timeframe === 'weekly'
                                    ? 'bg-accent text-white border-accent shadow-lg'
                                    : 'text-foreground-muted hover:text-foreground border-transparent'
                                    }`}
                            >
                                This Week
                                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${timeframe === 'weekly' ? 'bg-white/20' : 'bg-background-tertiary'}`}>Hot</span>
                            </button>
                        </div>
                    </div>

                    {/* Admin Recalculate Button */}
                    {currentUser && (profile?.role === 'admin' || profile?.role === 'su') && (
                        <div className="mt-8">
                            <Button
                                variant="secondary"
                                onClick={handleMigrate}
                                disabled={isMigrating}
                                isLoading={isMigrating}
                                size="sm"
                                className="border-primary/20 hover:border-primary mx-auto"
                            >
                                {isMigrating ? null : <Icons.sparkles size={14} className="mr-2" />}
                                Recalculate Influence Stats
                            </Button>
                        </div>
                    )}
                </div>

                {/* Queries Error Alert */}
                {queryError && (
                    <div className="mb-12 p-6 bg-error/10 border border-error/20 rounded-2xl text-error text-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <Icons.error size={24} className="flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-bold text-base mb-1">Index Required or Query Error</h3>
                            <p className="opacity-90 leading-relaxed">
                                {queryError}
                                {queryError.includes('index') && (
                                    <span className="block mt-2 p-3 bg-error/5 rounded-lg font-medium border border-error/10">
                                        Firestore needs a composite index to sort creators.
                                        {queryError.includes('https://') ? (
                                            <span className="block mt-1">
                                                Click this link to create it:
                                                <a href={queryError.split('https://')[1].split(' ')[0]} target="_blank" rel="noopener noreferrer" className="ml-1 underline break-all">
                                                    https://{queryError.split('https://')[1].split(' ')[0]}
                                                </a>
                                            </span>
                                        ) : (
                                            " If a link appeared in the console, please click it to create the index."
                                        )}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {topCreators.length === 0 ? (
                    <Card variant="glass" className="text-center py-20 rounded-3xl">
                        <div className="text-6xl mb-6">🏆</div>
                        <h3 className="text-2xl font-bold mb-2">The podium is empty!</h3>
                        <p className="text-foreground-muted">Be the first to publish and gain influence.</p>
                        <Button onClick={() => router.push('/dashboard')} className="mt-8 inline-flex">
                            Start Creating
                        </Button>
                    </Card>
                ) : (
                    <>
                        {/* Podium */}
                        <div className="flex flex-col md:flex-row items-end justify-center gap-4 mb-20 px-4">
                            {/* 2nd Place */}
                            {podium[1] && (
                                <div className="order-2 md:order-1 flex flex-col items-center w-full md:w-1/3">
                                    <Link href={`/profile/${podium[1].uid}`} className="group relative mb-4">
                                        <div className="absolute inset-0 bg-slate-400 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full scale-150" />
                                        {podium[1].photoURL ? (
                                            <img src={podium[1].photoURL} alt={podium[1].displayName || '2nd Place Creator'} className="w-24 h-24 rounded-full border-4 border-slate-300 relative z-10" />
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-500 border-4 border-slate-300 relative z-10">
                                                {podium[1].displayName?.charAt(0)}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center text-white font-black z-20 shadow-lg">2</div>
                                    </Link>
                                    <Card variant="glass" className="text-center p-6 w-full rounded-2xl border-b-8 border-slate-300/30">
                                        <h3 className="font-bold text-lg line-clamp-1">{podium[1].displayName}</h3>
                                        <div className="flex items-center justify-center gap-4 mt-2">
                                            <div className="text-center">
                                                <p className="text-primary font-black text-2xl">{podium[1].totalInfluence}</p>
                                                <p className="text-[8px] uppercase font-bold text-foreground-muted">Influence</p>
                                            </div>
                                            <div className="w-px h-8 bg-border" />
                                            <div className="text-center">
                                                <p className="text-foreground font-black text-2xl">{podium[1].publishedCount || 0}</p>
                                                <p className="text-[8px] uppercase font-bold text-foreground-muted">Images</p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* 1st Place */}
                            {podium[0] && (
                                <div className="order-1 md:order-2 flex flex-col items-center w-full md:w-1/3">
                                    <Link href={`/profile/${podium[0].uid}`} className="group relative mb-6 scale-110">
                                        <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-30 group-hover:opacity-50 transition-opacity rounded-full scale-150" />
                                        {podium[0].photoURL ? (
                                            <img src={podium[0].photoURL} alt={podium[0].displayName || '1st Place Creator'} className="w-32 h-32 rounded-full border-4 border-yellow-400 relative z-10 animate-pulse-slow" />
                                        ) : (
                                            <div className="w-32 h-32 rounded-full bg-yellow-50 flex items-center justify-center text-4xl font-bold text-yellow-600 border-4 border-yellow-400 relative z-10">
                                                {podium[0].displayName?.charAt(0)}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-white text-xl font-black z-20 shadow-xl shadow-yellow-400/20">👑</div>
                                    </Link>
                                    <Card variant="glass" className="text-center p-8 w-full rounded-2xl border-b-8 border-yellow-400/30">
                                        <h3 className="font-bold text-xl line-clamp-1">{podium[0].displayName}</h3>
                                        <div className="flex items-center justify-center gap-6 mt-2">
                                            <div className="text-center">
                                                <p className="text-primary font-black text-4xl">{podium[0].totalInfluence}</p>
                                                <p className="text-[8px] uppercase font-bold text-foreground-muted tracking-widest">{timeframe === 'weekly' ? 'Weekly' : 'Influence'}</p>
                                            </div>
                                            <div className="w-px h-12 bg-border" />
                                            <div className="text-center">
                                                <p className="text-foreground font-black text-4xl">{podium[0].publishedCount || 0}</p>
                                                <p className="text-[8px] uppercase font-bold text-foreground-muted tracking-widest">Creations</p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {podium[2] && (
                                <div className="order-3 md:order-3 flex flex-col items-center w-full md:w-1/3">
                                    <Link href={`/profile/${podium[2].uid}`} className="group relative mb-4">
                                        <div className="absolute inset-0 bg-orange-400 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full scale-150" />
                                        {podium[2].photoURL ? (
                                            <img src={podium[2].photoURL} alt={podium[2].displayName || '3rd Place Creator'} className="w-20 h-20 rounded-full border-4 border-orange-300 relative z-10" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-2xl font-bold text-orange-500 border-4 border-orange-300 relative z-10">
                                                {podium[2].displayName?.charAt(0)}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-300 rounded-full flex items-center justify-center text-white font-black z-20 shadow-lg">3</div>
                                    </Link>
                                    <Card variant="glass" className="text-center p-4 w-full rounded-2xl border-b-8 border-orange-300/30">
                                        <h3 className="font-bold text-base line-clamp-1">{podium[2].displayName}</h3>
                                        <div className="flex items-center justify-center gap-3 mt-1">
                                            <div className="text-center">
                                                <p className="text-primary font-black text-xl">{podium[2].totalInfluence}</p>
                                                <p className="text-[8px] uppercase font-bold text-foreground-muted">Influence</p>
                                            </div>
                                            <div className="w-px h-6 bg-border" />
                                            <div className="text-center">
                                                <p className="text-foreground font-black text-xl">{podium[2].publishedCount || 0}</p>
                                                <p className="text-[8px] uppercase font-bold text-foreground-muted">Images</p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>

                        {/* List view for the rest */}
                        <Card variant="glass" className="rounded-3xl overflow-hidden shadow-xl border-border/50">
                            <div className="bg-background-secondary/50 px-8 py-4 border-b border-border grid grid-cols-12 text-xs font-black uppercase tracking-widest text-foreground-muted items-center">
                                <span className="col-span-1 text-center">Rank</span>
                                <div className="col-span-6 px-12">Creator</div>
                                <span className="col-span-2 text-center">Images</span>
                                <span className="col-span-3 text-right">{timeframe === 'weekly' ? 'Weekly Score' : 'Influence Points'}</span>
                            </div>

                            <div className="divide-y divide-border/50">
                                {rest.map((creator, index) => (
                                    <Link
                                        key={creator.uid}
                                        href={`/profile/${creator.uid}`}
                                        className="grid grid-cols-12 items-center px-8 py-5 hover:bg-primary/5 transition-colors group"
                                    >
                                        <div className="col-span-1 text-center text-xl font-black text-foreground-muted group-hover:text-primary transition-colors">
                                            #{index + 4}
                                        </div>

                                        <div className="col-span-6 flex items-center gap-4 px-12">
                                            {creator.photoURL ? (
                                                <img src={creator.photoURL} alt={creator.displayName || 'Creator Avatar'} className="w-10 h-10 rounded-full border border-border" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center font-bold">
                                                    {creator.displayName?.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold group-hover:underline underline-offset-4">{creator.displayName}</p>
                                                <p className="text-xs text-foreground-muted capitalize">{creator.subscription} member</p>
                                            </div>
                                        </div>

                                        <div className="col-span-2 text-center">
                                            <span className="text-lg font-bold text-foreground">
                                                {creator.publishedCount || 0}
                                            </span>
                                        </div>

                                        <div className="col-span-3 text-right flex items-center justify-end gap-2">
                                            <span className="text-2xl font-black text-primary">
                                                {creator.totalInfluence}
                                            </span>
                                            <span className="text-xl">✨</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}
