'use client';

import { useEffect, useState } from 'react';
import { Icons } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth-context';

export default function QuotaWatcher() {
    const { user } = useAuth();
    const [quota, setQuota] = useState<{ limit: number, status: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchQuota = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/quota/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setQuota(data);
            }
        } catch (err) {
            console.error('Failed to fetch quota status:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuota();
        const interval = setInterval(fetchQuota, 300000); // Refresh every 5 minutes
        return () => clearInterval(interval);
    }, [user]);

    if (loading) {
        return <div className="h-4 w-12 bg-border/20 animate-pulse rounded" />;
    }

    const isRestricted = (quota?.limit || 0) <= 1;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background-secondary border border-border rounded-xl shadow-sm">
            <div className="relative">
                <Icons.activity size={14} className={isRestricted ? "text-amber-500" : "text-emerald-500 animate-pulse"} />
                {!isRestricted && <div className="absolute inset-0 bg-emerald-500/20 blur-sm rounded-full animate-pulse" />}
            </div>
            <span className="text-xs font-black tracking-tight">
                {quota?.limit || 1}
                <span className="text-[10px] text-muted-foreground ml-0.5">/min</span>
            </span>
            <Badge 
                variant={isRestricted ? "secondary" : "primary"} 
                size="sm" 
                className={isRestricted ? "bg-amber-500/10 text-amber-500 border-0" : "bg-emerald-500/10 text-emerald-500 border-0"}
            >
                {isRestricted ? "Probation" : "Sovereign"}
            </Badge>
        </div>
    );
}
