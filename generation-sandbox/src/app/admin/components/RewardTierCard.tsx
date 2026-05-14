'use client';

import { Card } from '@/components/ui/Card';

interface RewardTierCardProps {
    index: number;
    amount: number;
    onAmountChange: (newAmount: number) => void;
}

export function RewardTierCard({ index, amount, onAmountChange }: RewardTierCardProps) {
    const emojis = ['🥇', '🥈', '🥉'];
    const labels = ['1st', '2nd', '3rd'];

    return (
        <Card variant="glass" className="p-6 relative overflow-hidden group rounded-3xl">
            <div className="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition-transform duration-500">
                {emojis[index] || '🏆'}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-4">
                {labels[index] || `${index + 1}th`} Place Prize
            </p>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => onAmountChange(parseInt(e.target.value) || 0)}
                    className="bg-transparent text-2xl font-black w-24 text-white focus:outline-none"
                />
                <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Credits</span>
            </div>
        </Card>
    );
}
