'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { db } from '@/lib/firebase';
import {
    doc, getDoc, collection as firestoreCollection, query, where, getDocs,
    updateDoc, deleteDoc, serverTimestamp, arrayRemove,
    arrayUnion, increment, orderBy
} from 'firebase/firestore';
import { Collection, GeneratedImage } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { normalizeImageData } from '@/lib/image-utils';

export function useCollectionDetail(collectionId: string) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();

    const [collectionData, setCollectionData] = useState<Collection | null>(null);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user || !collectionId) return;
        setIsLoading(true);
        try {
            const colRef = doc(db, 'users', user.uid, 'collections', collectionId);
            const colSnap = await getDoc(colRef);

            if (!colSnap.exists()) {
                showToast('Collection not found', 'error');
                router.push('/collections');
                return;
            }

            const data = { id: colSnap.id, ...colSnap.data() } as Collection;
            setCollectionData(data);

            const imagesRef = firestoreCollection(db, 'users', user.uid, 'images');
            const [snapArray, snapLegacy] = await Promise.all([
                getDocs(query(imagesRef, where('collectionIds', 'array-contains', collectionId))),
                getDocs(query(imagesRef, where('collectionId', '==', collectionId)))
            ]);

            const imageMap = new Map();
            snapArray.docs.forEach(d => imageMap.set(d.id, normalizeImageData(d.data(), d.id)));
            snapLegacy.docs.forEach(d => imageMap.set(d.id, normalizeImageData(d.data(), d.id)));

            const fetchedImages = Array.from(imageMap.values()) as GeneratedImage[];
            fetchedImages.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

            setImages(fetchedImages);
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Failed to load collection content', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, collectionId, router, showToast]);

    useEffect(() => {
        if (user) fetchData();
        else if (!authLoading) setIsLoading(false);
    }, [user, authLoading, fetchData]);

    const handleRename = async (newName: string) => {
        if (!user || !newName.trim()) return;

        if (newName.length > 50) {
            showToast('Name too long', 'error');
            return;
        }

        try {
            await updateDoc(doc(db, 'users', user.uid, 'collections', collectionId), {
                name: newName.trim(),
                updatedAt: serverTimestamp()
            });
            setCollectionData(prev => prev ? { ...prev, name: newName.trim() } : null);
            showToast('Renamed successfully', 'success');
        } catch (err) {
            showToast('Rename failed', 'error');
        }
    };

    const handleAddTags = async (tagsString: string) => {
        if (!tagsString.trim() || !user) return;

        const newTags = tagsString.split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0 && t.length < 30);

        if (newTags.length === 0) return;

        setIsUpdating(true);
        try {
            const docRef = doc(db, 'users', user.uid, 'collections', collectionId);
            await updateDoc(docRef, {
                tags: arrayUnion(...newTags),
                updatedAt: serverTimestamp()
            });

            setCollectionData(prev => {
                if (!prev) return null;
                const existing = prev.tags || [];
                return { ...prev, tags: Array.from(new Set([...existing, ...newTags])) };
            });
            showToast('Tags added', 'success');
        } catch (err) {
            showToast('Failed to add tags', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveTag = async (tag: string) => {
        if (!user) return;
        setIsUpdating(true);
        try {
            const docRef = doc(db, 'users', user.uid, 'collections', collectionId);
            await updateDoc(docRef, {
                tags: arrayRemove(tag),
                updatedAt: serverTimestamp()
            });
            setCollectionData(prev => prev ? { ...prev, tags: (prev.tags || []).filter(t => t !== tag) } : null);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleTogglePrivacy = async () => {
        if (!user || !collectionData) return;
        const newPrivacy = collectionData.privacy === 'public' ? 'private' : 'public';
        try {
            await updateDoc(doc(db, 'users', user.uid, 'collections', collectionId), {
                privacy: newPrivacy,
                updatedAt: serverTimestamp()
            });
            setCollectionData(prev => prev ? { ...prev, privacy: newPrivacy } : null);
            showToast(`Collection is now ${newPrivacy}`, 'success');
        } catch (err) {
            showToast('Privacy update failed', 'error');
        }
    };

    const handleDeleteCollection = async () => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'collections', collectionId));
            showToast('Collection deleted', 'success');
            router.push('/collections');
        } catch (err) {
            showToast('Delete failed', 'error');
        }
    };

    const handleSetCover = async (url: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'collections', collectionId), { coverImageUrl: url });
            setCollectionData(prev => prev ? { ...prev, coverImageUrl: url } : null);
            showToast('Cover image updated', 'success');
        } catch (err) {
            showToast('Cover update failed', 'error');
        }
    };

    const handleRemoveImages = async () => {
        if (!user || selectedIds.size === 0) return;
        setIsUpdating(true);
        try {
            await Promise.all(Array.from(selectedIds).map(async id => {
                const imgRef = doc(db, 'users', user.uid, 'images', id);
                await updateDoc(imgRef, { collectionIds: arrayRemove(collectionId) });
            }));

            setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
            setCollectionData(prev => prev ? { ...prev, imageCount: Math.max(0, prev.imageCount - selectedIds.size) } : null);
            setSelectedIds(new Set());
            setSelectionMode(false);
            showToast(`${selectedIds.size} images removed from collection`, 'success');
        } catch (err) {
            showToast('Failed to remove images', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return {
        collectionData,
        images,
        setImages,
        isLoading,
        isUpdating,
        selectedIds,
        selectionMode,
        setSelectionMode,
        handleRename,
        handleAddTags,
        handleRemoveTag,
        handleTogglePrivacy,
        handleDeleteCollection,
        handleSetCover,
        handleRemoveImages,
        toggleSelection,
        refresh: fetchData
    };
}
