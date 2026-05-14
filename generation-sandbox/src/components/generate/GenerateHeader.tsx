'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import QuotaWatcher from './QuotaWatcher';

interface GenerateHeaderProps {
    availableCredits: number;
    onHistoryOpen: () => void;
    onGalleryClick: () => void;
    onDashboardClick: () => void;
    onPricingClick: () => void;
    onAdminClick: () => void;
    isAdmin: boolean;
}

export default function GenerateHeader({
    availableCredits,
    onHistoryOpen,
    onGalleryClick,
    onDashboardClick,
    onPricingClick,
    onAdminClick,
    isAdmin
}: GenerateHeaderProps) {
    return (
        <Card variant="glass" className="sticky top-0 z-50 border-x-0 border-t-0 rounded-none border-b border-border p-0">
            <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="secondary"
                        size="icon"
                        className="w-9 h-9"
                        onClick={onDashboardClick}
                    >
                        <Icons.arrowLeft size={18} />
                    </Button>
                    <div className="hidden sm:block">
                        <button
                            onClick={onDashboardClick}
                            className="flex items-center gap-2 text-xl font-black tracking-tighter hover:opacity-80 transition-opacity"
                        >
                            <span className="gradient-text">STILLWATER <span className="text-foreground">STUDIO</span></span>
                            <span className="text-[9px] font-black bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded tracking-widest leading-none align-middle">v0.1.0</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onGalleryClick}
                        className="h-9 gap-2 font-bold px-4"
                    >
                        <Icons.grid size={16} />
                        <span className="hidden md:inline">Registry</span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onHistoryOpen}
                        className="h-9 gap-2 font-bold px-4"
                    >
                        <Icons.history size={16} />
                        <span className="hidden md:inline">History</span>
                    </Button>

                    <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />

                    <QuotaWatcher />

                    <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />

                    <button 
                        onClick={onPricingClick}
                        className="group outline-none"
                    >
                        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-background-secondary border border-border rounded-xl group-hover:border-primary/50 transition-all shadow-sm">
                            <div className="relative">
                                <Icons.zap size={14} className="text-primary fill-primary animate-pulse" />
                                <div className="absolute inset-0 bg-primary/20 blur-sm rounded-full animate-pulse" />
                            </div>
                            <span className="text-sm font-black tracking-tight">{availableCredits}</span>
                            <Badge variant="primary" size="sm" className="bg-primary/10 text-primary border-0 !text-[8px] px-1 animate-in zoom-in-50">
                                Credits
                            </Badge>
                        </div>
                    </button>

                    {isAdmin && (
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={onAdminClick}
                            className="w-9 h-9 border-primary/20 text-primary hover:bg-primary/10"
                        >
                            <Icons.settings size={16} />
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
