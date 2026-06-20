'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, CommunityEntry, GeneratedImage } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { normalizeImageData } from '@/lib/image-utils';
import { useCommunityInteractions } from '@/hooks/useCommunityInteractions';
import { useCollectionsQuery } from '@/hooks/queries/useQueryHooks';

export function useProfile() {
    const params = useParams();
    const router = useRouter();
    const { showToast } = useToast();
    const { user: currentUser, loading: authLoading, profile: authProfile } = useAuth();

    // Resilient userId extraction
    const userId = useMemo(() => {
        // 1. Try to parse from pathname first (most reliable for rewrites)
        if (typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/');
            const profileIdx = pathParts.indexOf('profile');
            if (profileIdx !== -1 && pathParts[profileIdx + 1]) {
                const id = pathParts[profileIdx + 1];
                // Ignore dummy ID '1' if we have a real segment (unless the user IS '1')
                if (id && id !== '' && id !== 'index.html') {
                    return id.replace(/\/$/, '');
                }
            }
        }

        // 2. Fallback to router params
        if (params.userId) return params.userId as string;

        return '';
    }, [params.userId]);

    // Data State
    const [author, setAuthor] = useState<UserProfile | null>(null);
    // All generated images — the primary portfolio source
    const [images, setImages] = useState<GeneratedImage[]>([]);
    // Community entries for interactions (vote/comment/modal)
    const [communityEntries, setCommunityEntries] = useState<CommunityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'feed' | 'compact' | 'list'>('grid');
    const [isGrouped, setIsGrouped] = useState(false);
    const [showOnlyCommunity, setShowOnlyCommunity] = useState(false);

    // Lookup map: communityEntryId → CommunityEntry (for cross-referencing)
    const communityEntryMap = useMemo(() => {
        const map = new Map<string, CommunityEntry>();
        communityEntries.forEach(e => map.set(e.id, e));
        return map;
    }, [communityEntries]);

    const { data: collections = [] } = useCollectionsQuery(currentUser?.uid);

    // Interaction State (still driven by leagueEntries for vote/comment)
    const {
        selectedEntry,
        setSelectedEntry,
        comments,
        loadingComments,
        votingEntryId,
        isFollowing: isFollowingEntry,
        followLoading: followLoadingEntry,
        handleVote,
        handleToggleFollow: handleToggleFollowEntry,
        handleReactUpdate,
        handleAddComment,
        handleDeleteComment,
        handleReport,
        unpublishing,
        reactingEmoji,
        handleUnpublish: originalHandleUnpublish,
        handleToggleCollection,
        handleCreateCollection,
        viewerCollectionIds,
        loadingViewerCollections
    } = useCommunityInteractions(communityEntries, collections, setCommunityEntries);

    const [isFollowingProfile, setIsFollowingProfile] = useState(false);
    const [followLoadingProfile, setFollowLoadingProfile] = useState(false);

    // Computed Stats — use total images count, votes from community entries
    const stats = useMemo(() => {
        const totalVotes = communityEntries.reduce((sum, entry) => sum + (entry.voteCount || 0), 0);
        return {
            totalVotes,
            totalEntries: images.length
        };
    }, [communityEntries, images]);

    const fetchProfile = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            setQueryError(null);

            // 1. Fetch user document
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                showToast('User not found', 'error');
                router.push('/community');
                return;
            }

            const profileData = { uid: userSnap.id, ...userSnap.data() } as UserProfile;
            setAuthor(profileData);

            // 2. Fetch ALL generated images for this user (primary portfolio)
            const imagesRef = collection(db, 'users', userId, 'images');
            const imagesQuery = query(imagesRef, orderBy('createdAt', 'desc'));
            const imagesSnap = await getDocs(imagesQuery);
            const fetchedImages: GeneratedImage[] = imagesSnap.docs.map(d =>
                normalizeImageData(d.data(), d.id)
            );
            setImages(fetchedImages);

            // 3. Fetch community entries for interaction (vote/comment/modal)
            const entriesRef = collection(db, 'leagueEntries');
            const entriesQuery = query(entriesRef, where('originalUserId', '==', userId));
            const entriesSnap = await getDocs(entriesQuery);
            const fetchedEntries: CommunityEntry[] = entriesSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as CommunityEntry));
            setCommunityEntries(fetchedEntries);

            // 4. Check following status
            if (currentUser && currentUser.uid !== userId) {
                const followingRef = doc(db, 'users', currentUser.uid, 'following', userId);
                const followingSnap = await getDoc(followingRef);
                setIsFollowingProfile(followingSnap.exists());
            }

        } catch (error: any) {
            console.error('[Profile] Error fetching:', error);
            const errorMessage = error.code === 'permission-denied'
                ? 'Permission denied. Check your Firestore rules.'
                : error.message || 'Failed to load profile';

            showToast(errorMessage, 'error');
            setQueryError(error.message);
        } finally {
            setLoading(false);
        }
    }, [userId, currentUser, showToast, router]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleToggleFollowProfile = async () => {
        if (!currentUser || !author || followLoadingProfile) return;

        try {
            setFollowLoadingProfile(true);
            const action = isFollowingProfile ? 'unfollow' : 'follow';
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/user/follow/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId: userId, action })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setIsFollowingProfile(!isFollowingProfile);

            // Optimistic update for UI counts
            setAuthor(prev => prev ? {
                ...prev,
                followerCount: (prev.followerCount || 0) + (isFollowingProfile ? -1 : 1)
            } : null);

            showToast(isFollowingProfile ? 'Unfollowed creator' : 'Following creator!', 'success');
        } catch (error: any) {
            console.error('[Profile] Follow error:', error);
            showToast(error.message || 'Failed to update follow status', 'error');
        } finally {
            setFollowLoadingProfile(false);
        }
    };

    const handleUnpublish = useCallback(async () => {
        if (!selectedEntry) return;
        const imageId = selectedEntry.originalImageId;

        await originalHandleUnpublish();

        // After successful unpublish (handled inside originalHandleUnpublish), update local images state
        setImages(prev => prev.map(img =>
            img.id === imageId ? { ...img, publishedToCommunity: false, communityEntryId: undefined } : img
        ));
    }, [selectedEntry, originalHandleUnpublish]);


    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
        });
    };

    return {
        // State
        userId, author, images, communityEntries, communityEntryMap, loading, authLoading, queryError, stats,
        isFollowingProfile, followLoadingProfile, selectedEntry,
        currentUser, viewMode, setViewMode, isGrouped, setIsGrouped, showOnlyCommunity, setShowOnlyCommunity,
        comments, loadingComments, votingEntryId,
        isFollowingEntry, followLoadingEntry, reactingEmoji,
        userRole: authProfile?.role,
        collections,
        viewerCollectionIds,
        loadingViewerCollections,

        // Actions
        handleToggleFollowProfile, formatDate, setSelectedEntry,
        handleVote, handleReactUpdate, handleAddComment, handleDeleteComment, handleReport,
        handleToggleFollowEntry,
        handleUnpublish,
        handleToggleCollection,
        handleCreateCollection,
        unpublishing
    };
}
