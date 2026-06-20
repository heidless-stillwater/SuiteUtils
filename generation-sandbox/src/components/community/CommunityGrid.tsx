import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommunityEntry } from '@/lib/types';
import CommunityEntryCard from './CommunityEntryCard';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { SkeletonGrid, SkeletonFeed, SkeletonProfile } from '@/components/ui/Skeleton';
import { staggerContainer, staggerContainerSlow, cardFadeIn, fadeInUp } from '@/lib/animations';

interface CommunityGridProps {
    entries: CommunityEntry[];
    loadingEntries: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    userId: string | undefined;
    onVote: (entryId: string) => void;
    votingEntryId: string | null;
    onSelect: (entryId: string) => void;
    onReact: (entryId: string, emoji: string) => void;
    reactingEmoji?: string | null;
    viewMode: 'grid' | 'feed' | 'compact' | 'creators';
    isGrouped: boolean;
    isGroupedByUser: boolean;
    onFilterUser: (userId: string, userName: string) => void;
    onShare: (entryId: string) => void;
    sortMode?: string;
    error: string | null;
}

export default function CommunityGrid({
    entries,
    loadingEntries,
    loadingMore,
    hasMore,
    onLoadMore,
    userId,
    onVote,
    votingEntryId,
    onSelect,
    onReact,
    reactingEmoji,
    viewMode,
    isGrouped,
    isGroupedByUser,
    onFilterUser,
    onShare,
    sortMode,
    error
}: CommunityGridProps) {
    const router = useRouter();

    /** Grouping by Author (Internal "Creators" view mode) */
    const entriesByAuthor = useMemo(() => {
        if (viewMode !== 'creators') return [];
        const groups: Record<string, { authorName: string; authorPhotoURL: string | null; entries: CommunityEntry[]; userId: string; authorFollowerCount: number }> = {};
        entries.forEach(entry => {
            const uid = entry.originalUserId;
            if (!groups[uid]) {
                groups[uid] = {
                    authorName: entry.authorName || 'Anonymous',
                    authorPhotoURL: entry.authorPhotoURL,
                    userId: uid,
                    entries: [],
                    authorFollowerCount: entry.authorFollowerCount || 0
                };
            }
            groups[uid].entries.push(entry);
            // Keep the highest follower count seen for this user
            if ((entry.authorFollowerCount || 0) > groups[uid].authorFollowerCount) {
                groups[uid].authorFollowerCount = entry.authorFollowerCount || 0;
            }
        });

        return Object.values(groups).sort((a, b) => {
            if (sortMode === 'followed') {
                return b.authorFollowerCount - a.authorFollowerCount;
            }
            return b.entries.length - a.entries.length;
        });
    }, [entries, viewMode, sortMode]);

    const processedEntries = useMemo(() => {
        if (viewMode === 'creators') return entries;
        if (!isGrouped && !isGroupedByUser) return entries;

        const groups: Record<string, CommunityEntry[]> = {};
        const standalone: CommunityEntry[] = [];

        entries.forEach(entry => {
            // Grouping priority: User ID > Prompt Set ID
            const groupKey = isGroupedByUser
                ? entry.originalUserId
                : (isGrouped ? entry.promptSetID : null);

            if (groupKey) {
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(entry);
            } else {
                standalone.push(entry);
            }
        });

        const stacked: CommunityEntry[] = [];
        Object.values(groups).forEach(group => {
            if (group.length > 1) {
                const first = group[0];
                stacked.push({
                    ...first,
                    isStack: true,
                    stackSize: group.length,
                });
            } else {
                standalone.push(group[0]);
            }
        });

        return [...stacked, ...standalone].sort((a, b) => {
            const indexA = entries.findIndex(e => e.id === a.id);
            const indexB = entries.findIndex(e => e.id === b.id);
            return indexA - indexB;
        });
    }, [entries, isGrouped, isGroupedByUser, viewMode]);

    if (error) {
        return (
            <div className="mb-8 p-6 bg-error/10 border-2 border-error/20 rounded-2xl text-error flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-3">
                    <Icons.error className="w-6 h-6 flex-shrink-0" />
                    <h3 className="font-bold text-lg">Query Failed</h3>
                </div>
                <div className="space-y-3">
                    <p className="text-sm opacity-90">{error}</p>
                    {error.toLowerCase().includes('index') && (
                        <div className="p-4 bg-background/50 rounded-xl border border-error/20 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider opacity-60">System Instruction</p>
                            <p className="text-sm">
                                This filter requires a <strong>Firestore Composite Index</strong>.
                                Please check your browser&apos;s <strong>Developer Console (F12)</strong> for a direct link to create this index in the Firebase Console.
                            </p>
                        </div>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-fit border-error/30 text-error hover:bg-error/10"
                    onClick={() => window.location.reload()}
                >
                    Retry Connection
                </Button>
            </div>
        );
    }

    if (loadingEntries) {
        return (
            <AnimatePresence>
                <motion.div
                    key="skeleton"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {viewMode === 'feed' && <SkeletonFeed count={3} />}
                    {viewMode === 'creators' && (
                        <div className="space-y-10">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="space-y-4">
                                    <SkeletonProfile />
                                    <SkeletonGrid count={4} columns={4} />
                                </div>
                            ))}
                        </div>
                    )}
                    {viewMode === 'compact' && <SkeletonGrid count={12} columns={6} />}
                    {viewMode === 'grid' && <SkeletonGrid count={6} columns={3} />}
                </motion.div>
            </AnimatePresence>
        );
    }

    if (entries.length === 0) {
        return (
            <Card variant="glass" className="text-center py-16 rounded-2xl relative overflow-hidden">
                <div className="absolute top-4 right-4 z-10">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-20 hover:opacity-100 transition-opacity"
                        onClick={async () => {
                            try {
                                const m = await import('../../lib/services/community-backfill');
                                const count = await m.backfillCommunityMetrics();
                                alert(`Successfully synced ${count} entries. Refreshing...`);
                                window.location.reload();
                            } catch (err) {
                                alert('Sync failed. Check console for details.');
                            }
                        }}
                    >
                        <Icons.settings size={14} className="mr-2" />
                        Sync Engine
                    </Button>
                </div>
                <div className="text-6xl mb-6 opacity-30">🏆</div>
                <h2 className="text-2xl font-bold mb-3">No Results Found</h2>
                <p className="text-foreground-muted mb-8 max-w-sm mx-auto">
                    {sortMode === 'followed'
                        ? "We couldn't find any creators with followers yet. Try syncing the database metrics if you expect results here."
                        : "There are no entries in the community hub yet matching your filters."}
                </p>
                <div className="flex justify-center gap-3">
                    <Button variant="primary" onClick={async () => {
                        const m = await import('../../lib/services/community-backfill');
                        await m.backfillCommunityMetrics();
                        window.location.reload();
                    }}>
                        <Icons.sparkles size={16} className="mr-2" />
                        Sync & Refresh
                    </Button>
                    <Button variant="secondary" onClick={() => router.push('/gallery')}>
                        Go to Gallery
                    </Button>
                </div>
            </Card>
        );
    }

    if (viewMode === 'creators') {
        return (
            <motion.div
                className="space-y-12"
                variants={staggerContainerSlow}
                initial="initial"
                animate="animate"
            >
                {entriesByAuthor.map((group) => (
                    <motion.div key={group.userId} className="space-y-6" variants={fadeInUp}>
                        <Link
                            href={`/profile/${group.userId}`}
                            className="flex items-center gap-3 group/author w-fit"
                        >
                            {group.authorPhotoURL && group.authorPhotoURL !== 'null' ? (
                                <img src={group.authorPhotoURL} alt={group.authorName} className="w-10 h-10 rounded-full border-2 border-primary/20 group-hover/author:border-primary transition-colors" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center font-bold text-foreground-muted group-hover/author:text-primary transition-colors">
                                    {group.authorName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-lg group-hover/author:text-primary transition-colors">{group.authorName}</h3>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-foreground-muted">{group.entries.length} contributions</p>
                                    <span className="text-muted opacity-20 text-[10px]">|</span>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onFilterUser(group.userId, group.authorName);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                                    >
                                        Filter Feed
                                    </button>
                                </div>
                            </div>
                        </Link>

                        <motion.div
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                            variants={staggerContainer}
                            initial="initial"
                            animate="animate"
                        >
                            {group.entries.map((entry) => (
                                <motion.div key={entry.id} variants={cardFadeIn}>
                                    <CommunityEntryCard
                                        entry={entry}
                                        userId={userId || ''}
                                        onVote={onVote}
                                        isVoting={votingEntryId === entry.id}
                                        onSelect={onSelect}
                                        onReact={onReact}
                                        viewMode="compact"
                                        onFilterUser={onFilterUser}
                                        onShare={onShare}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                ))}

                {hasMore && (
                    <div className="mt-8 flex justify-center">
                        <Button
                            variant="secondary"
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            isLoading={loadingMore}
                            className="px-8 py-3 w-full md:w-auto"
                        >
                            Load More
                        </Button>
                    </div>
                )}
            </motion.div>
        );
    }

    return (
        <>
            <motion.div
                className={cn(
                    "grid gap-6 transition-all duration-300",
                    viewMode === 'grid' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                    viewMode === 'feed' && "grid-cols-1 max-w-2xl mx-auto gap-12",
                    viewMode === 'compact' && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                )}
                variants={viewMode === 'feed' ? staggerContainerSlow : staggerContainer}
                initial="initial"
                animate="animate"
            >
                {processedEntries.map((entry) => (
                    <motion.div key={entry.id} variants={cardFadeIn}>
                        <CommunityEntryCard
                            entry={entry}
                            userId={userId || ''}
                            onVote={onVote}
                            isVoting={votingEntryId === entry.id}
                            onSelect={onSelect}
                            onReact={onReact}
                            reactingEmoji={reactingEmoji}
                            viewMode={viewMode}
                            onFilterUser={onFilterUser}
                            onShare={onShare}
                        />
                    </motion.div>
                ))}
            </motion.div>

            {hasMore && (
                <div className="mt-8 flex justify-center">
                    <Button
                        variant="secondary"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        isLoading={loadingMore}
                        className="px-8 py-3 w-full md:w-auto"
                    >
                        Load More
                    </Button>
                </div>
            )}
        </>
    );
}
