'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { ModalStatus } from '@/components/StatusModal';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { SystemConfig } from '@/lib/types';

const DEFAULT_CONFIG: SystemConfig = {
    announcement: 'Welcome to Stillwater Studio!',
    showBanner: true,
    defaultModel: 'flash',
    safetyThreshold: 'medium',
    incentives: {
        welcomeCredits: { enabled: true, amount: 25 },
        founderBadge: { enabled: true, badgeId: 'og' },
        masterPass: { enabled: true, durationHours: 48 },
        communityBoost: { enabled: true, multiplier: 1.5 },
        knowledgeBounty: { enabled: true, rewardAmount: 50 },
        vanguardRole: { enabled: false, roleId: 'vanguard' },
    },
    updatedAt: null,
    updatedBy: '',
};

export function useAdminSettings() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();
    const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
    const [isSaving, setIsSaving] = useState(false);
    const [modalStatus, setModalStatus] = useState<ModalStatus>('idle');
    const [loading, setLoading] = useState(true);

    // Sync with Firestore
    useEffect(() => {
        if (!isAdmin) return;

        const configRef = doc(db, 'system', 'config');
        const unsubscribe = onSnapshot(configRef, (snapshot) => {
            if (snapshot.exists()) {
                setConfig(snapshot.data() as SystemConfig);
            } else {
                // Initialize with defaults if it doesn't exist
                setDoc(configRef, { ...DEFAULT_CONFIG, updatedAt: serverTimestamp() });
            }
            setLoading(false);
        }, (error) => {
            console.error('[Admin] Config sync error:', error);
            showToast('Failed to sync settings', 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAdmin, showToast]);

    const handleSave = async (updatedConfig: Partial<SystemConfig>) => {
        if (isSaving || !user) return;

        setIsSaving(true);
        setModalStatus('saving');

        try {
            const configRef = doc(db, 'system', 'config');
            const finalConfig = {
                ...config,
                ...updatedConfig,
                updatedAt: serverTimestamp(),
                updatedBy: user.uid,
            };

            await setDoc(configRef, finalConfig, { merge: true });
            setModalStatus('success');
        } catch (error) {
            console.error('[Admin] Save error:', error);
            showToast('Failed to save settings', 'error');
            setModalStatus('idle');
        } finally {
            setIsSaving(false);
        }
    };

    return {
        config,
        isSaving,
        modalStatus,
        setModalStatus,
        handleSave,
        loading
    };
}
