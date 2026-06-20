'use client';

import { useState, useEffect } from 'react';

export interface SovereignStatus {
    gated: boolean;
    status: 'red' | 'amber' | 'green';
    message?: string;
    breachedPolicySlug?: string;
    loading: boolean;
    error: boolean;
}

/**
 * Hook to monitor the Sovereign Compliance status of the suite.
 */
export function useSovereignStatus(enabled: boolean = true) {
    const [status, setStatus] = useState<SovereignStatus>({
        gated: false,
        status: 'green',
        loading: true,
        error: false
    });

    const checkStatus = async () => {
        console.log('[useSovereignStatus] Checking ecosystem status...', { enabled });
        const startTime = Date.now();
        try {
            const res = await fetch('/api/compliance/sovereign');
            const data = await res.json();

            // Ensure at least 800ms of loading time for visibility
            const elapsed = Date.now() - startTime;
            if (elapsed < 800) {
                await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
            }

            console.log('[useSovereignStatus] Status check complete:', data);
            setStatus({
                gated: !!data.gated,
                status: data.status || (data.gated ? 'red' : 'green'),
                message: data.message,
                breachedPolicySlug: data.breachedPolicySlug,
                loading: false,
                error: false
            });
        } catch (err) {
            console.error('[useSovereignStatus] Failed to fetch compliance state:', err);
            setStatus(prev => ({ ...prev, loading: false, error: true }));
        }
    };

    useEffect(() => {
        if (!enabled) return;
        
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, [enabled]);

    return status;
}
