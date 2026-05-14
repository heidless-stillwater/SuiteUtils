'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';

interface DashboardStatsProps {
    availableCredits: number;
    dailyRemaining: number;
    balance: number;
    imageCount: number;
    subscription: string;
}

export default function DashboardStats({
    availableCredits,
    dailyRemaining,
    balance,
    imageCount,
    subscription
}: DashboardStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="hover:border-primary/50 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-foreground-muted">Available Credits</span>
                    <Icons.zap className="text-primary group-hover:scale-110 transition-transform" size={20} />
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-4xl font-black gradient-text">{availableCredits}</p>
                        <p className="text-xs text-foreground-muted mt-1">
                            <span className="font-bold text-foreground/80">{dailyRemaining}</span> daily + <span className="font-bold text-foreground/80">{balance}</span> purchased
                        </p>
                    </div>
                    {subscription !== 'pro' && (
                        <Link href="/pricing">
                            <Button variant="secondary" size="sm" className="font-bold text-[10px] tracking-widest uppercase">
                                Upgrade
                            </Button>
                        </Link>
                    )}
                </div>
            </Card>

            <Card className="hover:border-primary/50 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-foreground-muted">Images Created</span>
                    <Icons.image className="text-accent group-hover:scale-110 transition-transform" size={20} />
                </div>
                <p className="text-4xl font-black text-foreground">{imageCount}</p>
                <p className="text-xs text-foreground-muted mt-1 font-medium">Total generations</p>
            </Card>

            <Card className="hover:border-primary/50 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-foreground-muted">Current Plan</span>
                    <Icons.trophy className="text-yellow-400 group-hover:scale-110 transition-transform" size={20} />
                </div>
                <p className="text-4xl font-black text-foreground capitalize">{subscription}</p>
                <p className="text-xs text-foreground-muted mt-1 font-medium">
                    {subscription === 'free' ? 'Upgrade for more features' : 'Premium features active'}
                </p>
            </Card>
        </div>
    );
}
