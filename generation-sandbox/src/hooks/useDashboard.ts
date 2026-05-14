import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    updateDoc,
    doc,
    deleteField,
    increment,
    serverTimestamp,
    deleteDoc,
    collectionGroup
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { GeneratedImage, CreditTransaction, Collection, ADMIN_EMAILS } from '@/lib/types';
import {
    useDashboardImages,
    useDashboardCommunityRecent,
    useCollectionsQuery,
    useCreditHistory,
    queryKeys
} from './queries/useQueryHooks';

export function useDashboard() {
    const { user, profile, credits, loading: authLoading, signOut, switchRole, effectiveRole, setAudienceMode, isAdmin, isSu } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    // Modals
    const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);

    // Filter & View State
    const [viewMode, setViewMode] = useState<'personal' | 'admin' | 'global'>('personal');
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [isGrouped, setIsGrouped] = useState(true);
    const [isVerifyingUpgrade, setIsVerifyingUpgrade] = useState(false);

    // Selection State
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Processing States
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkPublishing, setIsBulkPublishing] = useState(false);
    const [isBulkCollecting, setIsBulkCollecting] = useState(false);
    const [isBulkTagging, setIsBulkTagging] = useState(false);

    // ── TanStack Queries ───────────────────────────────────────

    const { data: recentImages = [], isLoading: loadingImages } = useDashboardImages(user?.uid, viewMode, isSu);
    const { data: recentCommunityEntries = [], isLoading: loadingCommunity } = useDashboardCommunityRecent();
    const { data: collections = [] } = useCollectionsQuery(user?.uid);
    const { data: creditHistory = [], isLoading: loadingHistory } = useCreditHistory(user?.uid);

    const groupImagesByPromptSet = (images: GeneratedImage[]) => {
        const groups: Record<string, GeneratedImage[]> = {};
        images.forEach(img => {
            const key = img.promptSetID || `single-${img.id}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(img);
        });
        return groups;
    };

    // Stripe Verification (stays in useEffect)
    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        if (sessionId && user && !isVerifyingUpgrade) {
            const verifySession = async () => {
                setIsVerifyingUpgrade(true);
                showToast('Verifying your upgrade...', 'info');
                try {
                    const token = await user.getIdToken();
                    const res = await fetch('/api/stripe/verify-session/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ sessionId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(data.alreadyProcessed ? 'Welcome back!' : 'Upgrade successful!', 'success');
                        router.replace('/dashboard');
                    }
                } catch (err) {
                    console.error('Session verification error:', err);
                    showToast('Failed to verify upgrade.', 'error');
                } finally {
                    setIsVerifyingUpgrade(false);
                }
            };
            verifySession();
        }
    }, [searchParams, user, router, showToast]);

    // Selection Handlers
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedIds(new Set());
    };

    const toggleImageSelection = (id: string, e?: React.MouseEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        setSelectedIds((prev: Set<string>) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleImageGroupSelection = (ids: string[], e?: React.MouseEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        setSelectedIds((prev: Set<string>) => {
            const next = new Set(prev);
            const allSelected = ids.every(id => next.has(id));
            if (allSelected) ids.forEach(id => next.delete(id));
            else ids.forEach(id => next.add(id));
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(recentImages.map((img: GeneratedImage) => img.id)));
    };

    // Bulk Actions
    const handleBulkDelete = async () => {
        if (!user || selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} images?`)) return;

        setIsBulkDeleting(true);
        try {
            const collectionDecrements: Record<string, number> = {};

            await Promise.all(Array.from(selectedIds).map(async (id) => {
                const img = recentImages.find((i: GeneratedImage) => i.id === id);
                if (!img) return;

                await deleteDoc(doc(db, 'users', user.uid, 'images', id));
                if (img.storagePath) {
                    try { await deleteObject(ref(storage, img.storagePath)); } catch (e) { }
                }

                if (img.collectionIds) {
                    img.collectionIds.forEach(colId => {
                        collectionDecrements[colId] = (collectionDecrements[colId] || 0) + 1;
                    });
                }
            }));

            // Stats updates
            await Promise.all(Object.entries(collectionDecrements).map(([colId, count]) =>
                updateDoc(doc(db, 'users', user.uid, 'collections', colId), {
                    imageCount: increment(-count)
                })
            ));

            // Invalidate queries to refresh UI
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.images(user.uid, viewMode) });
            queryClient.invalidateQueries({ queryKey: queryKeys.collections.all(user.uid) });

            setSelectedIds(new Set());
            setSelectionMode(false);
            showToast(`Deleted ${selectedIds.size} images`, 'success');
        } catch (err) {
            showToast('Delete failed.', 'error');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleBulkAddToCollection = async (collectionId: string) => {
        if (!user || selectedIds.size === 0) return;
        setIsBulkCollecting(true);
        try {
            let addedCount = 0;
            await Promise.all(Array.from(selectedIds).map(async (id) => {
                const img = recentImages.find((i: GeneratedImage) => i.id === id);
                if (!img) return;
                const currentIds = img.collectionIds || [];
                if (!currentIds.includes(collectionId)) {
                    addedCount++;
                    const newIds = [...currentIds, collectionId];
                    await updateDoc(doc(db, 'users', user.uid, 'images', id), {
                        collectionIds: newIds,
                        collectionId: deleteField()
                    });
                    img.collectionIds = newIds;
                }
            }));

            if (addedCount > 0) {
                await updateDoc(doc(db, 'users', user.uid, 'collections', collectionId), {
                    imageCount: increment(addedCount),
                    updatedAt: serverTimestamp()
                });
            }

            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.images(user.uid, viewMode) });
            queryClient.invalidateQueries({ queryKey: queryKeys.collections.all(user.uid) });

            setSelectedIds(new Set());
            setSelectionMode(false);
            setIsCollectionModalOpen(false);
            showToast('Added to collection', 'success');
        } catch (err) {
            showToast('Update failed.', 'error');
        } finally {
            setIsBulkCollecting(false);
        }
    };

    const handleBulkPublishToCommunity = async () => {
        if (!user || selectedIds.size === 0) return;
        if (!window.confirm(`Publish ${selectedIds.size} images to Community Hub?`)) return;

        setIsBulkPublishing(true);
        try {
            const token = await user.getIdToken();
            await Promise.all(Array.from(selectedIds).map(async (id) => {
                const img = recentImages.find((i: GeneratedImage) => i.id === id);
                if (!img || img.publishedToCommunity) return;

                const res = await fetch('/api/community/publish/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ imageId: id, action: 'publish' }),
                });

                if (res.ok) {
                    const data = await res.json();
                    img.publishedToCommunity = true;
                    img.communityEntryId = data.communityEntryId;
                }
            }));
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.images(user.uid, viewMode) });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.communityRecent });

            setSelectedIds(new Set());
            setSelectionMode(false);
            showToast('Published to Community Hub!', 'success');
        } finally {
            setIsBulkPublishing(false);
        }
    };

    const handleBulkAddTags = async (tags: string[]) => {
        if (!user || selectedIds.size === 0) return;
        setIsBulkTagging(true);
        try {
            await Promise.all(Array.from(selectedIds).map(async (id) => {
                const img = recentImages.find((i: GeneratedImage) => i.id === id);
                if (!img) return;
                const newTags = Array.from(new Set([...(img.tags || []), ...tags]));
                await updateDoc(doc(db, 'users', user.uid, 'images', id), { tags: newTags });
                img.tags = newTags;
            }));
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.images(user.uid, viewMode) });

            setSelectedIds(new Set());
            setSelectionMode(false);
            setIsTagModalOpen(false);
            showToast('Tags added', 'success');
        } finally {
            setIsBulkTagging(false);
        }
    };

    return {
        // State
        user, profile, authLoading, credits, recentImages, creditHistory, recentCommunityEntries,
        collections, loadingImages, loadingCommunity, loadingHistory, isHistoryExpanded,
        isGrouped, selectionMode, selectedIds, isBulkDeleting, isBulkPublishing,
        isBulkCollecting, isBulkTagging, isCollectionModalOpen, isTagModalOpen, effectiveRole,
        isAdmin, isSu, viewMode,

        // Actions
        signOut, switchRole, setAudienceMode, setIsHistoryExpanded, setIsGrouped,
        toggleSelectionMode, toggleImageSelection, toggleImageGroupSelection,
        handleSelectAll, handleBulkDelete, handleBulkAddToCollection,
        handleBulkPublishToCommunity, handleBulkAddTags, setIsCollectionModalOpen,
        setIsTagModalOpen, groupImagesByPromptSet, setSelectedIds, setSelectionMode, setViewMode
    };
}
