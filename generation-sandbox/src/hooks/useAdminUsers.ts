'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { UserProfile, UserCredits } from '@/lib/types';

interface ExtendedUserProfile extends UserProfile {
    creditsBalance?: number;
}

export function useAdminUsers() {
    const { user: adminUser } = useAuth();
    const { showToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<ExtendedUserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);

    const handleSearch = useCallback(async (queryStr: string = searchQuery) => {
        if (searching) return;
        setSearching(true);
        setLoading(true);
        try {
            const usersRef = collection(db, 'users');
            let q;

            if (queryStr.trim()) {
                q = query(
                    usersRef,
                    where('username', '>=', queryStr.toLowerCase()),
                    where('username', '<=', queryStr.toLowerCase() + '\uf8ff'),
                    limit(20)
                );
            } else {
                q = query(usersRef, limit(20));
            }

            const snap = await getDocs(q);
            const results = await Promise.all(snap.docs.map(async d => {
                const userData = { uid: d.id, ...d.data() } as UserProfile;
                let credits = 0;
                try {
                    const creditDoc = await getDoc(doc(db, 'users', d.id, 'data', 'credits'));
                    if (creditDoc.exists()) {
                        credits = (creditDoc.data() as UserCredits).balance;
                    }
                } catch (e) {
                    console.error('Failed to fetch credits for user', d.id, e);
                }
                return { ...userData, creditsBalance: credits } as ExtendedUserProfile;
            }));

            setUsers(results);
            if (results.length === 0 && queryStr.trim()) {
                showToast('No users found matching "' + queryStr + '"', 'info');
            }
        } catch (error: any) {
            showToast('Search failed: ' + error.message, 'error');
        } finally {
            setSearching(false);
            setLoading(false);
        }
    }, [searchQuery, searching, showToast]);

    useEffect(() => {
        handleSearch();
    }, []);

    const handleUpdateUserDetails = async (userId: string, updates: { role?: string, creditsChange?: number }) => {
        if (!adminUser || updatingUser) return;

        // Validation: Basic sanity check on credits adjustment
        if (updates.creditsChange !== undefined && isNaN(updates.creditsChange)) {
            showToast('Invalid credit amount', 'error');
            return;
        }

        setUpdatingUser(userId);
        try {
            const token = await adminUser.getIdToken();
            const res = await fetch('/api/admin/update-user-details/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId, ...updates })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(data.message || 'User updated', 'success');

            setUsers(prev => prev.map(u => {
                if (u.uid !== userId) return u;
                return {
                    ...u,
                    role: updates.role ? (updates.role as any) : u.role,
                    creditsBalance: updates.creditsChange
                        ? (u.creditsBalance || 0) + updates.creditsChange
                        : u.creditsBalance
                };
            }));
        } catch (error: any) {
            showToast(error.message || 'Failed to update user', 'error');
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleToggleBadge = async (userId: string, currentBadges: string[], badgeId: string) => {
        if (!adminUser || updatingUser) return;
        setUpdatingUser(userId);
        try {
            const hasBadge = (currentBadges || []).includes(badgeId);
            const newBadges = hasBadge
                ? currentBadges.filter(b => b !== badgeId)
                : [...(currentBadges || []), badgeId];

            const token = await adminUser.getIdToken();
            const res = await fetch('/api/admin/update-badges/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId, badges: newBadges })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(data.message || 'Updated badges', 'success');
            setUsers(prev => prev.map(u => u.uid === userId ? { ...u, badges: newBadges } : u));
        } catch (error: any) {
            showToast(error.message || 'Failed to update badges', 'error');
        } finally {
            setUpdatingUser(null);
        }
    };

    return {
        users,
        loading,
        searching,
        searchQuery,
        setSearchQuery,
        updatingUser,
        handleSearch,
        handleUpdateUserDetails,
        handleToggleBadge
    };
}
