'use client';

import { CreditTransaction, GeneratedImage } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface CreditActivityProps {
    isExpanded: boolean;
    setIsExpanded: (val: boolean) => void;
    loading: boolean;
    history: CreditTransaction[];
    recentImages: GeneratedImage[];
}

export default function CreditActivity({
    isExpanded,
    setIsExpanded,
    loading,
    history,
    recentImages
}: CreditActivityProps) {
    return (
        <section className="mb-12">
            <Card
                variant="glass"
                className="w-full flex items-center justify-between p-6 cursor-pointer hover:border-primary/50 transition-all group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Icons.clock size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-xl font-bold">Credit Activity</h3>
                        <p className="text-xs text-foreground-muted">View your recent credit usage and transactions</p>
                    </div>
                </div>
                <div className={cn(
                    "p-2 rounded-lg bg-background-secondary border border-border transition-transform duration-300",
                    isExpanded && "rotate-180"
                )}>
                    <Icons.arrowDown size={20} />
                </div>
            </Card>

            <div className={cn(
                "transition-all duration-500 overflow-hidden",
                isExpanded ? "max-h-[500px] mt-4 opacity-100" : "max-h-0 opacity-0"
            )}>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : history.length === 0 ? (
                    <Card className="text-center py-8 text-foreground-muted">
                        No recent credit activity
                    </Card>
                ) : (
                    <Card variant="glass" className="overflow-hidden">
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-background-secondary/50 sticky top-0 z-10">
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Preview</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {history.map((tx) => {
                                        const txDate = tx.createdAt?.toDate ? tx.createdAt.toDate().getTime() : new Date(tx.createdAt).getTime();
                                        const metadataImage = tx.metadata?.imageUrl;
                                        const matchingImage = metadataImage ? { imageUrl: metadataImage } : (tx.type === 'usage' ? recentImages.find(img => {
                                            const imgDate = img.createdAt?.toDate ? img.createdAt.toDate().getTime() : new Date(img.createdAt as any).getTime();
                                            return Math.abs(imgDate - txDate) < 10000;
                                        }) : null);

                                        return (
                                            <tr key={tx.id} className="hover:bg-background-secondary/30 transition-colors">
                                                <td className="px-6 py-4 text-sm text-foreground-muted whitespace-nowrap">
                                                    {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : new Date(tx.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {matchingImage ? (
                                                        <img
                                                            src={matchingImage.imageUrl}
                                                            alt="Generation preview"
                                                            className="w-10 h-10 rounded object-cover border border-border"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-background-secondary border border-border flex items-center justify-center text-lg">
                                                            {tx.type === 'usage' ? '🎨' : '💎'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-medium">
                                                    <p className="line-clamp-1">{tx.metadata?.prompt || tx.description}</p>
                                                    {tx.type === 'usage' && tx.metadata?.quality && (
                                                        <span className="mt-1 inline-block px-1.5 py-0.5 bg-background-secondary border border-border rounded text-[10px] uppercase">
                                                            {tx.metadata.quality}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`px-6 py-4 text-sm font-bold text-right whitespace-nowrap ${tx.amount > 0 ? 'text-success' : 'text-error'}`}>
                                                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </section>
    );
}
