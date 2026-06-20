import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CommunityEntry } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { SortMode } from '@/components/community/CommunityHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCommunityInteractions } from '@/hooks/useCommunityInteractions';
import {
    useCommunityThumbnails,
    useCommunityEntries,
    useCollectionsQuery,
    useCommunityEntry,
} from '@/hooks/queries/useQueryHooks';

export function useCommunity() {
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    // ── Local UI State ──────────────────────────────────────
    const [sortMode, setSortMode] = useState<SortMode>('recent');
    const [viewMode, setViewMode] = useState<'grid' | 'feed' | 'compact' | 'creators'>('compact');
    const [isGrouped, setIsGrouped] = useState(false);
    const [isGroupedByUser, setIsGroupedByUser] = useState(false);
    const [filterUserId, setFilterUserId] = useState<string | null>(null);
    const [filterUserName, setFilterUserName] = useState<string | null>(null);

    // ── Pagination (still manual — TanStack infinite query is a future step) ──
    const [extraEntries, setExtraEntries] = useState<CommunityEntry[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastVisibleRef = useRef<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // ── TanStack Query: Thumbnails (5-min cache) ────────────
    const { data: quickLinkThumbnails = [] } = useCommunityThumbnails();

    // ── TanStack Query: Initial entries (30s stale time) ────
    const {
        data: queriedEntries = [],
        isLoading: loadingEntries,
        error: queryErrorObj,
        refetch: refetchEntries,
    } = useCommunityEntries(sortMode, filterUserId);

    const queryError = queryErrorObj ? (queryErrorObj as Error).message : null;

    // ── TanStack Query: Collections ─────────────────────────
    const { data: collections = [] } = useCollectionsQuery(user?.uid);

    // ── Merge queried entries with "load more" entries ───────
    const entries = useMemo(() => {
        // Initial page from TanStack Query
        const initial = queriedEntries;
        // Map extra entries by ID for deduplication
        const initialIds = new Set(initial.map(e => e.id));
        const dedupedExtra = extraEntries.filter(e => !initialIds.has(e.id));
        return [...initial, ...dedupedExtra];
    }, [queriedEntries, extraEntries]);

    // Reset pagination ONLY when sort or filter changes
    useEffect(() => {
        setExtraEntries([]);
        lastVisibleRef.current = null;
        setHasMore(queriedEntries.length === 20);
    }, [sortMode, filterUserId]);

    // ── Real-time listener for newest entries ───────────────
    useEffect(() => {
        if (!user || (sortMode !== 'recent' && sortMode !== 'newest') || filterUserId) return;

        const q = query(collection(db, 'leagueEntries'), orderBy('publishedAt', 'desc'), limit(1));

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            if (snapshot.empty) return;
            // Instead of manual state updates, trigger a refetch of the first page
            refetchEntries();
        }, (err: any) => {
            console.error('Real-time listener error:', err);
        });

        return () => unsubscribe();
    }, [user, sortMode, filterUserId, refetchEntries]);

    // ── Persist view mode & grouping ────────────────────────
    useEffect(() => {
        const savedView = localStorage.getItem('communityViewPreference');
        const savedGroup = localStorage.getItem('communityIsGrouped');
        const savedGroupByUser = localStorage.getItem('communityIsGroupedByUser');

        if (savedView === 'grid' || savedView === 'feed' || savedView === 'compact' || savedView === 'creators') {
            setViewMode(savedView);
        } else if (savedView === 'grouped') {
            setViewMode('creators');
        }

        if (savedGroup === 'true') setIsGrouped(true);
        if (savedGroupByUser === 'true') setIsGroupedByUser(true);
    }, []);

    // ── View / Sort handlers ────────────────────────────────
    const handleViewModeChange = (mode: 'grid' | 'feed' | 'compact' | 'creators') => {
        setViewMode(mode);
        localStorage.setItem('communityViewPreference', mode);
    };

    const handleToggleGrouped = () => {
        const next = !isGrouped;
        setIsGrouped(next);
        localStorage.setItem('communityIsGrouped', String(next));
    };

    const handleSortModeChange = (mode: SortMode) => {
        setSortMode(mode);
        if (mode === 'followed') setViewMode('creators');
    };

    const handleToggleGroupedByUser = () => {
        const next = !isGroupedByUser;
        setIsGroupedByUser(next);
        localStorage.setItem('communityIsGroupedByUser', String(next));
    };

    // ── Interaction hooks ───────────────────────────────────
    const {
        selectedEntry,
        setSelectedEntry,
        comments,
        loadingComments,
        votingEntryId,
        isFollowing,
        followLoading,
        handleVote,
        handleToggleFollow,
        handleReactUpdate,
        handleAddComment,
        handleDeleteComment,
        handleReport,
        handleToggleCollection,
        handleCreateCollection,
        unpublishing,
        reactingEmoji,
        handleUnpublish,
        handleShare,
        viewerCollectionIds,
        loadingViewerCollections,
        handleAddTag,
        handleRemoveTag,
        handleUpdatePromptSetID,
        handleUpdateTitle,
        isAdmin,
        handleToggleExemplar,
        handleUnpublishRequest,
        showUnpublishConfirm,
        setShowUnpublishConfirm,
    } = useCommunityInteractions(entries, collections, setExtraEntries);

    // ── Manual "load more" pagination ───────────────────────
    const fetchEntries = useCallback(async (isLoadMore = false) => {
        if (!isLoadMore) {
            // For initial load, we rely on the TanStack query.
            // Just trigger a refetch.
            refetchEntries();
            return;
        }

        if (!user) return;
        setLoadingMore(true);

        try {
            const { where, doc, getDoc } = await import('firebase/firestore');
            const entriesRef = collection(db, 'leagueEntries');
            let q;

            if (filterUserId) {
                q = query(entriesRef, where('originalUserId', '==', filterUserId), orderBy('publishedAt', 'desc'));
            } else if (sortMode === 'newest' || sortMode === 'recent') {
                q = query(entriesRef, orderBy('publishedAt', 'desc'));
            } else if (sortMode === 'variations' || sortMode === 'creations') {
                q = query(entriesRef, orderBy('variationCount', 'desc'), orderBy('publishedAt', 'desc'));
            } else if (sortMode === 'images') {
                q = query(entriesRef, orderBy('commentCount', 'desc'), orderBy('publishedAt', 'desc'));
            } else if (sortMode === 'shared') {
                q = query(entriesRef, orderBy('shareCount', 'desc'), orderBy('publishedAt', 'desc'));
            } else if (sortMode === 'followed') {
                q = query(entriesRef, orderBy('authorFollowerCount', 'desc'), orderBy('publishedAt', 'desc'));
            } else {
                q = query(entriesRef, orderBy('voteCount', 'desc'), orderBy('publishedAt', 'desc'));
            }

            // For the first "load more", use the last entry from the initial query
            // to determine the cursor
            if (lastVisibleRef.current) {
                q = query(q, startAfter(lastVisibleRef.current), limit(20));
            } else {
                // First load-more: we need the last doc from the initial page.
                // Re-run the query with our current count to get the cursor.
                const cursorQuery = query(q, limit(entries.length));
                const cursorSnap = await getDocs(cursorQuery);
                const lastCursor = cursorSnap.docs[cursorSnap.docs.length - 1];
                if (lastCursor) {
                    q = query(q, startAfter(lastCursor), limit(20));
                } else {
                    setHasMore(false);
                    setLoadingMore(false);
                    return;
                }
            }

            const snapshot = await getDocs(q);
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            lastVisibleRef.current = lastDoc || null;
            setHasMore(snapshot.docs.length === 20);

            const fetched: CommunityEntry[] = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            } as CommunityEntry));

            // Enrich with fresh author profiles
            const uniqueUserIds = Array.from(new Set(fetched.map(e => e.originalUserId)));
            const profileMap: Record<string, any> = {};

            await Promise.all(
                uniqueUserIds.map(async (uid) => {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        if (userDoc.exists()) profileMap[uid] = userDoc.data();
                    } catch (_) { }
                })
            );

            const enriched = fetched.map(entry => {
                const p = profileMap[entry.originalUserId];
                if (p) {
                    return {
                        ...entry,
                        authorName: p.displayName || entry.authorName,
                        authorPhotoURL: p.photoURL ?? entry.authorPhotoURL,
                        authorBadges: p.badges || entry.authorBadges || [],
                    };
                }
                return entry;
            });

            setExtraEntries(prev => [...prev, ...enriched]);
        } catch (error: any) {
            console.error('[Community] Load more error:', error);
            showToast('Failed to load more entries', 'error');
        } finally {
            setLoadingMore(false);
        }
    }, [user, sortMode, filterUserId, entries.length, refetchEntries, showToast]);

    // ── Filter by user ──────────────────────────────────────
    const handleFilterUser = (uid: string | null, name: string | null) => {
        setFilterUserId(uid);
        setFilterUserName(name);
        setExtraEntries([]);
        lastVisibleRef.current = null;
        setHasMore(true);
    };

    // ── Deep link handling ──────────────────────────────────
    const entryIdParam = searchParams.get('entryId');
    const { data: deepLinkedEntry } = useCommunityEntry(
        // Only fetch if we can't find the entry in the current list
        entryIdParam && entries.length > 0 && !entries.find(e => e.id === entryIdParam) && !loadingEntries
            ? entryIdParam
            : null
    );

    useEffect(() => {
        if (!entryIdParam || entries.length === 0) return;

        const entry = entries.find(e => e.id === entryIdParam);
        if (entry) {
            setSelectedEntry(entry.id);
        } else if (deepLinkedEntry) {
            setSelectedEntry(deepLinkedEntry.id);
        }
    }, [entryIdParam, entries, deepLinkedEntry, loadingEntries, setSelectedEntry]);

    // ── Public API (unchanged interface) ────────────────────
    return {
        user,
        profile,
        entries,
        collections,
        loadingEntries,
        loadingMore,
        hasMore,
        sortMode,
        setSortMode: handleSortModeChange,
        viewMode,
        setViewMode: handleViewModeChange,
        isGrouped,
        handleToggleGrouped,
        isGroupedByUser,
        handleToggleGroupedByUser,
        filterUserId,
        filterUserName,
        handleFilterUser,
        queryError,
        fetchEntries,
        selectedEntry,
        setSelectedEntry,
        comments,
        loadingComments,
        votingEntryId,
        isFollowing,
        followLoading,
        unpublishing,
        handleToggleFollow,
        handleVote,
        handleReactUpdate,
        reactingEmoji,
        handleAddComment,
        handleDeleteComment,
        handleReport,
        handleToggleCollection,
        handleCreateCollection,
        handleUnpublish,
        handleShare,
        viewerCollectionIds,
        loadingViewerCollections,
        quickLinkThumbnails,
        handleAddTag,
        handleRemoveTag,
        handleUpdatePromptSetID,
        handleUpdateTitle,
        isAdmin,
        handleToggleExemplar,
        handleUnpublishRequest,
        showUnpublishConfirm,
        setShowUnpublishConfirm,
        refetchEntries,
    };
}
