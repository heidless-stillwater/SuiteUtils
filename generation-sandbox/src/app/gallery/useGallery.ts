import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, deleteDoc, doc, updateDoc, increment, startAfter, QueryDocumentSnapshot, addDoc, serverTimestamp, deleteField, arrayUnion, arrayRemove, collectionGroup, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GeneratedImage, Collection, ADMIN_EMAILS } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { normalizeImageData } from '@/lib/image-utils';

export function useGallery() {
    const { 
        user, profile, credits, 
        effectiveRole, switchRole, setAudienceMode, 
        signOut, isSu, isAdmin, loading: authLoading 
    } = useAuth();
    const { showToast } = useToast();

    const availableCredits = credits
        ? credits.balance + Math.max(0, credits.dailyAllowance - credits.dailyAllowanceUsed)
        : 0;

    // Data State
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [loadingImages, setLoadingImages] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastVisibleRef = useRef<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [collections, setCollections] = useState<Collection[]>([]);

    // Selection State
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<GeneratedImage[] | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterQuality, setFilterQuality] = useState<'all' | 'standard' | 'high' | 'ultra'>('all');
    const [filterAspectRatio, setFilterAspectRatio] = useState<string>('all');
    const [filterTag, setFilterTag] = useState<string>('all');
    const [filterExemplar, setFilterExemplar] = useState(false);
    const [filterCommunity, setFilterCommunity] = useState(false);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'personal' | 'admin' | 'global'>('personal');
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'az' | 'za' | 'recent_update' | 'old_update'>('newest');
    const [gridDensity, setGridDensity] = useState<number>(4);


    // Advanced Filter State
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterSeed, setFilterSeed] = useState('');
    const [filterGuidanceMin, setFilterGuidanceMin] = useState('');
    const [filterGuidanceMax, setFilterGuidanceMax] = useState('');
    const [filterHasNegativePrompt, setFilterHasNegativePrompt] = useState<'all' | 'yes' | 'no'>('all');

    // UI State
    const [isGrouped, setIsGrouped] = useState(true);
    const [showCreateCollection, setShowCreateCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [creatingCollection, setCreatingCollection] = useState(false);
    const [collectionError, setCollectionError] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [batchDeleting, setBatchDeleting] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Editing State
    const [isEditingPromptSetID, setIsEditingPromptSetID] = useState(false);
    const [editingPromptSetID, setEditingPromptSetID] = useState('');
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [isSavingPromptSetID, setIsSavingPromptSetID] = useState(false);
    const [newImageTag, setNewImageTag] = useState('');
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [unpublishConfirmImage, setUnpublishConfirmImage] = useState<GeneratedImage | null>(null);

    // Fetch Images
    const fetchImages = useCallback(async (isLoadMore = false) => {
        if (!user) return;

        try {
            if (isLoadMore) {
                setLoadingMore(true);
            } else {
                setLoadingImages(true);
            }

            let q;
            const isPersonal = viewMode === 'personal';
            const isGlobal = viewMode === 'global' && isSu;
            const isAdminView = viewMode === 'admin' && isSu;

            // Firestore query always uses createdAt for broad compatibility (prevents filtering images missing updatedAt)
            const sortField = 'createdAt';
            const sortOrder = (sortMode === 'oldest') ? 'asc' : 'desc';

            if (isPersonal) {
                const imagesRef = collection(db, 'users', user.uid, 'images');
                q = query(imagesRef, orderBy(sortField, sortOrder), limit(48));
                if (isLoadMore && lastVisibleRef.current) {
                    q = query(imagesRef, orderBy(sortField, sortOrder), startAfter(lastVisibleRef.current), limit(48));
                }
            } else if (isGlobal) {
                const imagesRef = collectionGroup(db, 'images');
                q = query(imagesRef, orderBy(sortField, sortOrder), limit(48));
                if (isLoadMore && lastVisibleRef.current) {
                    q = query(imagesRef, orderBy(sortField, sortOrder), startAfter(lastVisibleRef.current), limit(48));
                }
            } else if (isAdminView) {
                const imagesRef = collectionGroup(db, 'images');
                q = query(imagesRef, where('userId', 'in', ADMIN_EMAILS), orderBy(sortField, sortOrder), limit(48));
                if (isLoadMore && lastVisibleRef.current) {
                    q = query(imagesRef, where('userId', 'in', ADMIN_EMAILS), orderBy(sortField, sortOrder), startAfter(lastVisibleRef.current), limit(48));
                }
            } else {
                // Fallback to personal if not su but trying to access admin/global
                const imagesRef = collection(db, 'users', user.uid, 'images');
                q = query(imagesRef, orderBy(sortField, sortOrder), limit(48));
                if (isLoadMore && lastVisibleRef.current) {
                    q = query(imagesRef, orderBy(sortField, sortOrder), startAfter(lastVisibleRef.current), limit(48));
                }
            }

            const snapshot = await getDocs(q);
            const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
            lastVisibleRef.current = lastVisibleDoc;
            setHasMore(snapshot.docs.length === 48);

            const fetchedImages: GeneratedImage[] = snapshot.docs.map(doc =>
                normalizeImageData(doc.data(), doc.id)
            );

            if (isLoadMore) {
                setImages(prev => [...prev, ...fetchedImages]);
            } else {
                setImages(fetchedImages);
            }
        } catch (error) {
            console.error('Error fetching images:', error);
        } finally {
            setLoadingImages(false);
            setLoadingMore(false);
        }
    }, [user, viewMode, isSu, sortMode]);

    // Fetch Collections
    const fetchCollections = useCallback(() => {
        if (!user) return () => {};
        
        try {
            const colRef = collection(db, 'users', user.uid, 'collections');
            const q = query(colRef, orderBy('createdAt', 'desc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetched = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Collection));
                setCollections(fetched);
            }, (error) => {
                console.error('Error fetching collections stream:', error);
            });
            
            return unsubscribe;
        } catch (error) {
            console.error('Error setting up collections listener:', error);
            return () => {};
        }
    }, [user]);

    // Actions
    const [confirmationState, setConfirmationState] = useState<{ type: 'single' | 'batch', id?: string } | null>(null);

    // Actions
    const performDelete = async (imageId: string) => {
        if (!user) return;

        setDeletingId(imageId);
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'images', imageId));
            setImages(prev => prev.filter(img => img.id !== imageId));
            
            // Sync with selectedImage
            if (selectedImage?.id === imageId) {
                setSelectedImage(null);
            }

            // Sync with selectedGroup (Variation Modal)
            if (selectedGroup) {
                const updatedGroup = selectedGroup.filter(img => img.id !== imageId);
                setSelectedGroup(updatedGroup.length > 0 ? updatedGroup : null);
            }

            showToast('Image deleted successfully', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete image', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const performBatchDelete = async () => {
        if (!user || selectedImageIds.size === 0) return;

        setBatchDeleting(true);
        try {
            await Promise.all(Array.from(selectedImageIds).map(id =>
                deleteDoc(doc(db, 'users', user.uid, 'images', id))
            ));
            
            setImages(prev => prev.filter(img => !selectedImageIds.has(img.id)));

            // Sync with selectedGroup
            if (selectedGroup) {
                const updatedGroup = selectedGroup.filter(img => !selectedImageIds.has(img.id));
                setSelectedGroup(updatedGroup.length > 0 ? updatedGroup : null);
            }

            setSelectedImageIds(new Set());
            setSelectionMode(false);
            showToast('Batch delete complete!', 'success');
        } catch (error) {
            console.error('Batch delete error:', error);
            showToast('Failed to delete some images', 'error');
        } finally {
            setBatchDeleting(false);
        }
    };

    const handleDelete = (imageId: string) => {
        setConfirmationState({ type: 'single', id: imageId });
    };

    const handleBatchDelete = () => {
        if (selectedImageIds.size === 0) return;
        setConfirmationState({ type: 'batch' });
    };

    const confirmDelete = async () => {
        if (!confirmationState) return;

        if (confirmationState.type === 'single' && confirmationState.id) {
            await performDelete(confirmationState.id);
        } else if (confirmationState.type === 'batch') {
            await performBatchDelete();
        }
        setConfirmationState(null);
    };

    const cancelDelete = () => {
        setConfirmationState(null);
    };

    const handleCreateCollection = async () => {
        if (!user || !newCollectionName.trim()) return;
        setCreatingCollection(true);
        setCollectionError('');
        try {
            const colRef = collection(db, 'users', user.uid, 'collections');
            const newColData = {
                userId: user.uid,
                name: newCollectionName.trim(),
                imageCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            const docRef = await addDoc(colRef, newColData);

            setNewCollectionName('');
            setShowCreateCollection(false);
            showToast(`Collection "${newColData.name}" created`, 'success');
        } catch (error: any) {
            console.error('Error creating collection:', error);
            setCollectionError(error.message || 'Failed to create collection.');
            showToast('Failed to create collection', 'error');
        } finally {
            setCreatingCollection(false);
        }
    };

    const handleCommunityToggle = async (image: GeneratedImage) => {
        if (!user) return;
        if (image.publishedToCommunity) {
            setUnpublishConfirmImage(image);
        } else {
            performCommunityToggle(image, 'publish');
        }
    };

    const performCommunityToggle = async (image: GeneratedImage, action: 'publish' | 'unpublish') => {
        if (!user) return;
        setPublishingId(image.id);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/community/publish/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ imageId: image.id, action }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const updatedImage: GeneratedImage = {
                ...image,
                publishedToCommunity: action === 'publish',
                communityEntryId: action === 'publish' ? data.communityEntryId : undefined,
            };

            setImages(prev => prev.map(img => img.id === image.id ? updatedImage : img));
            if (selectedImage?.id === image.id) {
                setSelectedImage(updatedImage);
            }
            if (selectedGroup) {
                setSelectedGroup(prev => prev ? prev.map(img => img.id === image.id ? updatedImage : img) : null);
            }

            showToast(
                action === 'publish' ? '🏆 Published to Community Hub!' : 'Removed from Community Hub',
                'success'
            );
        } catch (error: any) {
            console.error('[Gallery] Community toggle error:', error);
            showToast(error.message || 'Failed to update community status', 'error');
        } finally {
            setPublishingId(null);
            setUnpublishConfirmImage(null);
        }
    };

    const handleAddImageTag = async () => {
        if (!user || !selectedImage || !newImageTag.trim()) return;

        const tag = newImageTag.trim().toLowerCase();
        if (selectedImage.tags?.includes(tag)) {
            setNewImageTag('');
            return;
        }

        setIsUpdatingTags(true);
        try {
            const imageRef = doc(db, 'users', user.uid, 'images', selectedImage.id);
            await updateDoc(imageRef, {
                tags: arrayUnion(tag)
            });

            // Sync to community if published
            if (selectedImage.publishedToCommunity && selectedImage.communityEntryId) {
                const communityRef = doc(db, 'leagueEntries', selectedImage.communityEntryId);
                await updateDoc(communityRef, {
                    tags: arrayUnion(tag)
                }).catch(err => console.error('[Gallery Sync] Failed to sync tag to community:', err));
            }

            // Update local state
            const updatedTags = [...(selectedImage.tags || []), tag];
            const updatedImage = { ...selectedImage, tags: updatedTags };
            setSelectedImage(updatedImage);
            setImages(prev => prev.map(img => img.id === selectedImage.id ? updatedImage : img));
            setNewImageTag('');
            showToast('Tag added', 'success');
        } catch (error) {
            console.error('Failed to add tag:', error);
            showToast('Failed to add tag', 'error');
        } finally {
            setIsUpdatingTags(false);
        }
    };

    const handleRemoveImageTag = async (tag: string) => {
        if (!user || !selectedImage) return;

        setIsUpdatingTags(true);
        try {
            const imageRef = doc(db, 'users', user.uid, 'images', selectedImage.id);
            await updateDoc(imageRef, {
                tags: arrayRemove(tag)
            });

            // Sync to community if published
            if (selectedImage.publishedToCommunity && selectedImage.communityEntryId) {
                const communityRef = doc(db, 'leagueEntries', selectedImage.communityEntryId);
                await updateDoc(communityRef, {
                    tags: arrayRemove(tag)
                }).catch(err => console.error('[Gallery Sync] Failed to sync tag removal to community:', err));
            }

            // Update local state
            const updatedTags = (selectedImage.tags || []).filter(t => t !== tag);
            const updatedImage = { ...selectedImage, tags: updatedTags };
            setSelectedImage(updatedImage);
            setImages(prev => prev.map(img => img.id === selectedImage.id ? updatedImage : img));
            showToast('Tag removed', 'success');
        } catch (error) {
            console.error('Failed to remove tag:', error);
            showToast('Failed to remove tag', 'error');
        } finally {
            setIsUpdatingTags(false);
        }
    };

    const handleUpdatePromptSetID = async () => {
        if (!user || !selectedImage) return;

        setIsSavingPromptSetID(true);
        try {
            const cleanID = editingPromptSetID.trim();
            const imageRef = doc(db, 'users', user.uid, 'images', selectedImage.id);

            await updateDoc(imageRef, {
                promptSetID: cleanID || deleteField()
            });

            // Sync to community if published
            if (selectedImage.publishedToCommunity && selectedImage.communityEntryId) {
                const communityRef = doc(db, 'leagueEntries', selectedImage.communityEntryId);
                await updateDoc(communityRef, {
                    promptSetID: cleanID || null
                }).catch(err => console.error('[Gallery Sync] Failed to sync Prompt Set ID to community:', err));
            }

            // Update local state
            const updatedImage = { ...selectedImage, promptSetID: cleanID || undefined };
            setImages(prev => prev.map(img => img.id === selectedImage.id ? updatedImage : img));
            setSelectedImage(updatedImage);

            setIsEditingPromptSetID(false);
            showToast('Prompt Set ID updated', 'success');
        } catch (error) {
            console.error('Error updating promptSetID:', error);
            showToast('Failed to update Prompt Set ID', 'error');
        } finally {
            setIsSavingPromptSetID(false);
        }
    };

    const handleToggleExemplar = async () => {
        if (!user || !selectedImage || !isAdmin) return;

        const newValue = !selectedImage.isExemplar;
        try {
            const imageRef = doc(db, 'users', user.uid, 'images', selectedImage.id);
            await updateDoc(imageRef, {
                isExemplar: newValue
            });

            // Sync to community if published
            if (selectedImage.publishedToCommunity && selectedImage.communityEntryId) {
                const communityRef = doc(db, 'leagueEntries', selectedImage.communityEntryId);
                await updateDoc(communityRef, {
                    isExemplar: newValue
                }).catch(err => console.error('[Gallery Sync] Failed to sync Exemplar status to community:', err));
            }

            // Update local state
            const updatedImage = { ...selectedImage, isExemplar: newValue };
            setSelectedImage(updatedImage);
            setImages(prev => prev.map(img => img.id === selectedImage.id ? updatedImage : img));
            if (selectedGroup) {
                setSelectedGroup(prev => prev ? prev.map(img => img.id === selectedImage.id ? updatedImage : img) : null);
            }
            showToast(newValue ? 'Marked as Exemplar' : 'Removed Exemplar status', 'success');
        } catch (error) {
            console.error('Failed to toggle Exemplar status:', error);
            showToast('Failed to update Exemplar status', 'error');
        }
    };

    const handleToggleCollection = async (imageId: string, collectionId: string) => {
        if (!user) return;

        // Optimistic update
        const image = images.find(img => img.id === imageId);
        if (!image) return;

        const currentIds = image.collectionIds || [];
        // Legacy fallback only if collectionIds is missing
        if (!image.collectionIds && image.collectionId) {
            currentIds.push(image.collectionId);
        }

        const isAdding = !currentIds.includes(collectionId);
        let newIds: string[];

        if (isAdding) {
            newIds = [...currentIds, collectionId];
        } else {
            newIds = currentIds.filter(id => id !== collectionId);
        }

        try {
            // Update local state immediately
            setImages(prev => prev.map(img =>
                img.id === imageId ? { ...img, collectionIds: newIds, collectionId: undefined } : img
            ));

            if (selectedImage?.id === imageId) {
                setSelectedImage(prev => prev ? { ...prev, collectionIds: newIds, collectionId: undefined } : null);
            }

            const imageRef = doc(db, 'users', user.uid, 'images', imageId);

            await updateDoc(imageRef, {
                collectionIds: newIds,
                collectionId: deleteField() // Correct way to remove field in Firestore
            });

            fetchCollections();
            showToast(isAdding ? 'Added to collection' : 'Removed from collection', 'success');

        } catch (error) {
            console.error('Error toggling collection:', error);
            showToast('Failed to update collection', 'error');
        }
    };

    const handleBatchToggleCollection = async (batchImages: GeneratedImage[], collectionId: string) => {
        if (!user || !batchImages.length) return;

        const allIn = batchImages.every(img => (img.collectionIds || []).includes(collectionId));
        const isAdding = !allIn;

        try {
            const batchPromises = batchImages.map(img => {
                const currentIds = img.collectionIds || [];
                if (!img.collectionIds && img.collectionId) {
                    currentIds.push(img.collectionId);
                }

                let newIds: string[];
                if (isAdding) {
                    newIds = currentIds.includes(collectionId) ? currentIds : [...currentIds, collectionId];
                } else {
                    newIds = currentIds.filter(id => id !== collectionId);
                }

                const imageRef = doc(db, 'users', user.uid, 'images', img.id);
                return updateDoc(imageRef, {
                    collectionIds: newIds,
                    collectionId: deleteField()
                });
            });

            await Promise.all(batchPromises);

            // Update local state
            setImages(prev => prev.map(img => {
                const isInBatch = batchImages.some(b => b.id === img.id);
                if (!isInBatch) return img;

                const currentIds = img.collectionIds || [];
                if (!img.collectionIds && img.collectionId) currentIds.push(img.collectionId);

                let newIds: string[];
                if (isAdding) {
                    newIds = currentIds.includes(collectionId) ? currentIds : [...currentIds, collectionId];
                } else {
                    newIds = currentIds.filter(id => id !== collectionId);
                }

                return { ...img, collectionIds: newIds, collectionId: undefined };
            }));

            // Update selectedGroup
            setSelectedGroup(prev => {
                if (!prev) return null;
                return prev.map(img => {
                    const currentIds = img.collectionIds || [];
                    if (!img.collectionIds && img.collectionId) currentIds.push(img.collectionId);
                    let newIds: string[];
                    if (isAdding) {
                        newIds = currentIds.includes(collectionId) ? currentIds : [...currentIds, collectionId];
                    } else {
                        newIds = currentIds.filter(id => id !== collectionId);
                    }
                    return { ...img, collectionIds: newIds, collectionId: undefined };
                });
            });

            fetchCollections();
            showToast(isAdding ? `Added ${batchImages.length} images to collection` : `Removed ${batchImages.length} images from collection`, 'success');
        } catch (error) {
            console.error('Error batch toggling collection:', error);
            showToast('Failed to update collections', 'error');
        }
    };

    const handleDownload = async (image: GeneratedImage, format: 'png' | 'jpeg' = 'png') => {
        try {
            console.log('[Gallery] Initiating download for image:', image.id);
            const filename = `studio-image-${image.id}.${format}`;
            const proxyUrl = `/api/download/?url=${encodeURIComponent(image.imageUrl)}&filename=${encodeURIComponent(filename)}`;

            const link = document.createElement('a');
            link.href = proxyUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (user) {
                const imageRef = doc(db, 'users', user.uid, 'images', image.id);
                await updateDoc(imageRef, {
                    downloadCount: increment(1),
                });
            }
            console.log('[Gallery] Download triggered successfully via proxy');
        } catch (error) {
            console.error('[Gallery] Download error:', error);
            window.open(image.imageUrl, '_blank');
        }
    };

    const groupImagesByPromptSet = useCallback((images: GeneratedImage[]) => {
        const groups: Record<string, GeneratedImage[]> = {};
        images.forEach(img => {
            const key = img.promptSetID || `single-${img.id}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(img);
        });
        return groups;
    }, []);

    const handleBatchUpdateTitle = async (batchImages: GeneratedImage[], newTitle: string) => {
        if (!user || !batchImages.length) return false;

        try {
            const cleanTitle = newTitle.trim();
            const batchPromises = batchImages.map(img => {
                const imageRef = doc(db, 'users', user.uid, 'images', img.id);
                return updateDoc(imageRef, {
                    title: cleanTitle || deleteField()
                });
            });

            await Promise.all(batchPromises);

            const communityPromises = batchImages
                .filter(img => (img.publishedToCommunity || img.publishedToLeague) && (img.communityEntryId || img.leagueEntryId))
                .map(img => {
                    const entryId = img.communityEntryId || img.leagueEntryId;
                    const communityRef = doc(db, 'leagueEntries', entryId!);
                    return updateDoc(communityRef, {
                        title: cleanTitle || deleteField()
                    }).catch(err => console.error('[useGallery] Failed to sync Title to community:', err));
                });
            
            if (communityPromises.length > 0) {
                await Promise.all(communityPromises);
            }

            setImages(prev => prev.map(img => {
                const isInBatch = batchImages.some(b => b.id === img.id);
                if (!isInBatch) return img;
                return { ...img, title: cleanTitle || undefined };
            }));

            setSelectedGroup(prev => {
                if (!prev) return null;
                return prev.map(img => {
                    const isInBatch = batchImages.some(b => b.id === img.id);
                    if (!isInBatch) return img;
                    return { ...img, title: cleanTitle || undefined };
                });
            });

            showToast(`Updated title for ${batchImages.length} images`, 'success');
            return true;
        } catch (error) {
            console.error('Error batch updating titles:', error);
            showToast('Failed to update titles', 'error');
            return false;
        }
    };

    const handleUpdateImage = (updatedImage: GeneratedImage) => {
        setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
        if (selectedImage?.id === updatedImage.id) {
            setSelectedImage(updatedImage);
        }
        if (selectedGroup) {
            setSelectedGroup(prev => prev ? prev.map(img => img.id === updatedImage.id ? updatedImage : img) : null);
        }
    };

    // Filter Logic
    const filteredImages = images.filter(img => {
        const matchesSearch = img.prompt.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesQuality = filterQuality === 'all' || img.settings.quality === filterQuality;
        const matchesAspectRatio = filterAspectRatio === 'all' || img.settings.aspectRatio === filterAspectRatio;

        const matchesCollection = !selectedCollectionId ||
            (img.collectionIds ? img.collectionIds.includes(selectedCollectionId) : (img.collectionId === selectedCollectionId));

        const matchesTag = filterTag === 'all' || collections.some(col =>
            (img.collectionIds?.includes(col.id) || img.collectionId === col.id) &&
            col.tags?.some(t => t.toLowerCase() === filterTag.toLowerCase())
        );

        const matchesSeed = !filterSeed.trim() || String(img.settings?.seed ?? '') === filterSeed.trim();
        const imgGuidance = img.settings?.guidanceScale;
        const matchesGuidanceMin = !filterGuidanceMin || (imgGuidance !== undefined && imgGuidance >= parseFloat(filterGuidanceMin));
        const matchesGuidanceMax = !filterGuidanceMax || (imgGuidance !== undefined && imgGuidance <= parseFloat(filterGuidanceMax));
        const matchesNegPrompt = filterHasNegativePrompt === 'all' ||
            (filterHasNegativePrompt === 'yes' && !!img.settings?.negativePrompt?.trim()) ||
            (filterHasNegativePrompt === 'no' && !img.settings?.negativePrompt?.trim());
        const matchesExemplar = !filterExemplar || !!img.isExemplar;
        const matchesCommunity = !filterCommunity || !!img.publishedToCommunity;

        return matchesSearch && matchesQuality && matchesAspectRatio && matchesCollection && matchesTag && matchesSeed && matchesGuidanceMin && matchesGuidanceMax && matchesNegPrompt && matchesExemplar && matchesCommunity;
    }).sort((a, b) => {
        if (sortMode === 'az') {
            return (a.title || a.prompt).localeCompare(b.title || b.prompt);
        }
        if (sortMode === 'za') {
            return (b.title || b.prompt).localeCompare(a.title || a.prompt);
        }
        // Date sorting is primarily handled by Firestore, but we sort here for safety/filtered results
        if (sortMode === 'newest') {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        }
        if (sortMode === 'oldest') {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeA - timeB;
        }
        if (sortMode === 'recent_update') {
            const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
            const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
            return timeB - timeA;
        }
        if (sortMode === 'old_update') {
            const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
            const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
            return timeA - timeB;
        }
        return 0;
    });

    // Navigation
    const handleNextImage = () => {
        if (!selectedImage) return;
        const index = filteredImages.findIndex(img => img.id === selectedImage.id);
        if (index < filteredImages.length - 1) {
            setSelectedImage(filteredImages[index + 1]);
        }
    };

    const handlePrevImage = () => {
        if (!selectedImage) return;
        const index = filteredImages.findIndex(img => img.id === selectedImage.id);
        if (index > 0) {
            setSelectedImage(filteredImages[index - 1]);
        }
    };

    return {
        // State
        images, filteredImages, loadingImages, loadingMore, hasMore,
        collections, selectedCollectionId, setSelectedCollectionId,
        selectedImage, setSelectedImage,
        selectedGroup, setSelectedGroup,
        selectionMode, setSelectionMode, selectedImageIds, setSelectedImageIds,
        searchQuery, setSearchQuery,
        filterQuality, setFilterQuality,
        filterAspectRatio, setFilterAspectRatio,
        filterTag, setFilterTag,
        filterExemplar, setFilterExemplar,
        filterCommunity, setFilterCommunity,
        showAdvancedFilters, setShowAdvancedFilters,
        filterSeed, setFilterSeed,
        filterGuidanceMin, setFilterGuidanceMin,
        filterGuidanceMax, setFilterGuidanceMax,
        filterHasNegativePrompt, setFilterHasNegativePrompt,
        sortMode, setSortMode,
        isGrouped, setIsGrouped,
        showCreateCollection, setShowCreateCollection,
        newCollectionName, setNewCollectionName,
        creatingCollection, collectionError, setCollectionError,
        deletingId, batchDeleting, publishingId,
        isEditingPromptSetID, setIsEditingPromptSetID,
        editingPromptSetID, setEditingPromptSetID,
        isSavingPromptSetID, setIsSavingPromptSetID,
        newImageTag, setNewImageTag,
        isUpdatingTags, setIsUpdatingTags, // Export setter
        unpublishConfirmImage, setUnpublishConfirmImage,
        viewMode, setViewMode, isSu, isAdmin,
        gridDensity, setGridDensity,
        isSidebarCollapsed, setIsSidebarCollapsed,

        // Auth
        user, profile, credits, availableCredits, 
        effectiveRole, switchRole, setAudienceMode, signOut, authLoading,


        // Actions
        fetchImages, fetchCollections,
        handleDelete, handleBatchDelete, handleCreateCollection,
        handleCommunityToggle,
        confirmUnpublish: async () => {
            if (unpublishConfirmImage) {
                await performCommunityToggle(unpublishConfirmImage, 'unpublish');
            }
        },
        groupImagesByPromptSet,

        setImages,
        handleAddImageTag, handleRemoveImageTag,
        handleUpdatePromptSetID, handleToggleExemplar, handleToggleCollection, handleBatchToggleCollection, handleBatchUpdateTitle,
        handleDownload, handleNextImage, handlePrevImage, handleUpdateImage,
        confirmationState, confirmDelete, cancelDelete
    };
}
