'use client';

import { useState, useCallback, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeagueEntry, LeagueComment } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';

export function useAdminModeration() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [reportedEntries, setReportedEntries] = useState<LeagueEntry[]>([]);
    const [reportedComments, setReportedComments] = useState<LeagueComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const fetchReported = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const entriesRef = collection(db, 'leagueEntries');
            const q = query(
                entriesRef,
                where('reportCount', '>', 0),
                orderBy('reportCount', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const entries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LeagueEntry));

            setReportedEntries(entries);

            const commentsQ = query(
                collectionGroup(db, 'comments'),
                where('reportCount', '>', 0),
                orderBy('reportCount', 'desc'),
                limit(50)
            );
            const commentsSnap = await getDocs(commentsQ);
            const comments = commentsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LeagueComment));
            setReportedComments(comments);

        } catch (error: any) {
            console.error('[Moderation] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchReported();
    }, [fetchReported]);

    const handleAction = async (entryId: string, action: 'dismiss' | 'remove') => {
        if (!user || actioningId) return;

        try {
            setActioningId(entryId);
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/league/action/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ entryId, action })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(data.message, 'success');
            setReportedEntries(prev => prev.filter(e => e.id !== entryId));
        } catch (error: any) {
            console.error('[Moderation] Action error:', error);
            showToast(error.message || 'Failed to perform action', 'error');
            throw error;
        } finally {
            setActioningId(null);
        }
    };

    const handleCommentAction = async (comment: LeagueComment, action: 'dismiss' | 'delete') => {
        if (!user || actioningId) return;

        try {
            setActioningId(comment.id);
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/comment/action/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    entryId: comment.entryId,
                    commentId: comment.id,
                    action
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(data.message, 'success');
            setReportedComments(prev => prev.filter(c => c.id !== comment.id));
        } catch (error: any) {
            console.error('[Moderation] Comment Action error:', error);
            showToast(error.message || 'Failed to action comment', 'error');
            throw error;
        } finally {
            setActioningId(null);
        }
    };

    return {
        reportedEntries,
        reportedComments,
        loading,
        actioningId,
        handleAction,
        handleCommentAction,
        refresh: fetchReported
    };
}
