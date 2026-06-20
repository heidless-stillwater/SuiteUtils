'use client';

import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
    label: string;
    value: string | number;
    unit?: string;
    variant: 'primary' | 'accent' | 'success' | 'amber';
}

export function StatCard({ label, value, unit, variant }: StatCardProps) {
    const variantClasses = {
        primary: 'border-l-primary',
        accent: 'border-l-accent',
        success: 'border-l-success',
        amber: 'border-l-amber-500'
    };

    const unitClasses = {
        primary: 'text-primary',
        accent: 'text-accent',
        success: 'text-success',
        amber: 'text-amber-500'
    };

    return (
        <Card variant="glass" className={cn("p-6 border-l-4 rounded-2xl", variantClasses[variant])}>
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black">{typeof value === 'number' ? value.toLocaleString() : value}</h3>
                {unit && <span className={cn("text-xs font-bold", unitClasses[variant])}>{unit}</span>}
            </div>
        </Card>
    );
}
