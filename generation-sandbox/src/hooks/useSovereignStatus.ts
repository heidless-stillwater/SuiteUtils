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
export function useSovereignStatus() {
    const [status, setStatus] = useState<SovereignStatus>({
        gated: false,
        status: 'green',
        loading: true,
        error: false
    });

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/compliance/sovereign');
            const data = await res.json();

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
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    return status;
}
