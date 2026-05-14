'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';

interface AdminStats {
    totalUsers: number;
    proUsers: number;
    totalImages: number;
    totalCreditsUsed: number;
    totalLifetimeUsed: number;
    activeContestants?: number;
    totalVotes: number;
    totalComments: number;
    totalPublished: number;
    topTags: { tag: string; count: number }[];
    recentGenerations: number;
}

interface LeaderInfo {
    uid: string;
    username: string;
    displayName: string;
    photoURL: string | null;
    score: number;
    publishedCount?: number;
}

export function useAdminOverview() {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [stats, setStats] = useState<AdminStats>({
        totalUsers: 0,
        proUsers: 0,
        totalImages: 0,
        totalCreditsUsed: 0,
        totalLifetimeUsed: 0,
        activeContestants: 0,
        totalVotes: 0,
        totalComments: 0,
        totalPublished: 0,
        topTags: [],
        recentGenerations: 0
    });

    const [loading, setLoading] = useState(true);
    const [rewardAmounts, setRewardAmounts] = useState<number[]>([500, 250, 100]);
    const [savingRewards, setSavingRewards] = useState(false);
    const [leaderPreview, setLeaderPreview] = useState<LeaderInfo[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [awarding, setAwarding] = useState(false);
    const [isBackfilling, setIsBackfilling] = useState(false);

    const fetchRewardsAndPreview = useCallback(async () => {
        if (!user) return;
        setLoadingPreview(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/rewards-preview/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                if (data.leaders) setLeaderPreview(data.leaders);
                if (data.currentRewards) setRewardAmounts(data.currentRewards);
                if (data.totalContestants !== undefined) {
                    setStats(prev => ({ ...prev, activeContestants: data.totalContestants }));
                }
            }
        } catch (error) {
            console.error('Failed to fetch rewards preview:', error);
        } finally {
            setLoadingPreview(false);
        }
    }, [user]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/stats/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(prev => ({
                    ...prev,
                    totalUsers: data.totalUsers,
                    proUsers: data.proUsers,
                    totalImages: data.totalImages,
                    totalCreditsUsed: data.totalCreditsHeld,
                    totalLifetimeUsed: data.totalLifetimeUsed,
                    totalVotes: data.totalVotes || 0,
                    totalComments: data.totalComments || 0,
                    totalPublished: data.totalPublished || 0,
                    topTags: data.topTags || [],
                    recentGenerations: data.recentGenerations || 0
                }));
            }
            await fetchRewardsAndPreview();
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
        } finally {
            setLoading(false);
        }
    }, [user, fetchRewardsAndPreview]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateRewards = async () => {
        if (!user || savingRewards) return;

        // Validation: Ensure all rewards are positive integers
        if (rewardAmounts.some(amount => isNaN(amount) || amount < 0)) {
            showToast('Rewards must be positive numbers', 'error');
            return;
        }

        setSavingRewards(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/update-settings/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'rewards',
                    settings: { amounts: rewardAmounts }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast('Reward amounts updated successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to update rewards', 'error');
        } finally {
            setSavingRewards(false);
        }
    };

    const confirmAwardWeekly = async () => {
        if (!user || awarding) return;
        setAwarding(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/award-weekly/', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(data.message, 'success');
            await fetchRewardsAndPreview();
        } catch (error: any) {
            showToast(error.message || 'Failed to award rewards', 'error');
        } finally {
            setAwarding(false);
        }
    };

    const confirmBackfill = async () => {
        if (!user || isBackfilling) return;
        setIsBackfilling(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/community/backfill', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(`Backfill complete: ${data.updated} entries updated, ${data.skipped} skipped.`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Backfill failed', 'error');
        } finally {
            setIsBackfilling(false);
        }
    };

    return {
        stats,
        loading,
        rewardAmounts,
        setRewardAmounts,
        savingRewards,
        leaderPreview,
        loadingPreview,
        awarding,
        isBackfilling,
        handleUpdateRewards,
        confirmAwardWeekly,
        confirmBackfill,
        refresh: fetchData
    };
}
