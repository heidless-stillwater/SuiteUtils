'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    orderBy,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';
import { Collection } from '@/lib/types';

export function useCollections() {
    const { user, loading: authLoading } = useAuth();
    const { showToast } = useToast();
    const [collections, setCollections] = useState<Collection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    const fetchCollections = useCallback(async () => {
        if (!user) return;
        try {
            const colRef = collection(db, 'users', user.uid, 'collections');
            const q = query(colRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Collection));
            setCollections(fetched);
        } catch (error) {
            console.error('Failed to fetch collections:', error);
            showToast('Failed to load collections', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        if (user) {
            fetchCollections();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [user, authLoading, fetchCollections]);

    const handleCreate = async (name: string) => {
        if (!name || !name.trim() || !user) {
            showToast('Collection name is required', 'error');
            return;
        }

        if (name.length > 50) {
            showToast('Collection name is too long (max 50 chars)', 'error');
            return;
        }

        setIsCreating(true);
        try {
            const newCollection = {
                userId: user.uid,
                name: name.trim(),
                imageCount: 0,
                privacy: 'private',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'collections'), newCollection);

            const created: Collection = {
                id: docRef.id,
                ...newCollection,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any;

            setCollections(prev => [created, ...prev]);
            showToast('Collection created', 'success');
            return created;
        } catch (error) {
            console.error('Failed to create collection:', error);
            showToast('Failed to create collection', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'collections', id));
            setCollections(prev => prev.filter(c => c.id !== id));
            showToast('Collection deleted', 'success');
        } catch (error) {
            console.error('Failed to delete collection:', error);
            showToast('Failed to delete collection', 'error');
        }
    };

    const handleRename = async (id: string, newName: string) => {
        if (!user || !newName.trim()) return;

        if (newName.length > 50) {
            showToast('Name too long', 'error');
            return;
        }

        try {
            const docRef = doc(db, 'users', user.uid, 'collections', id);
            await updateDoc(docRef, {
                name: newName.trim(),
                updatedAt: serverTimestamp()
            });

            setCollections(prev => prev.map(c =>
                c.id === id ? { ...c, name: newName.trim() } : c
            ));
            showToast('Collection renamed', 'success');
        } catch (error) {
            console.error('Failed to rename collection:', error);
            showToast('Failed to rename collection', 'error');
        }
    };

    const handleTogglePrivacy = async (id: string, currentPrivacy: 'public' | 'private') => {
        if (!user) return;
        const newPrivacy = currentPrivacy === 'public' ? 'private' : 'public';
        try {
            const docRef = doc(db, 'users', user.uid, 'collections', id);
            await updateDoc(docRef, {
                privacy: newPrivacy,
                updatedAt: serverTimestamp()
            });

            setCollections(prev => prev.map(c =>
                c.id === id ? { ...c, privacy: newPrivacy } : c
            ));
            showToast(`Collection is now ${newPrivacy}`, 'success');
        } catch (error) {
            console.error('Failed to update privacy:', error);
            showToast('Failed to update privacy', 'error');
        }
    };

    return {
        collections,
        isLoading,
        isCreating,
        handleCreate,
        handleDelete,
        handleRename,
        handleTogglePrivacy,
        refresh: fetchCollections
    };
}
