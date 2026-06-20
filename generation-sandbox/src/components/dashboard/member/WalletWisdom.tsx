'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';

interface WalletWisdomProps {
    credits: any;
}

export default function WalletWisdom({ credits }: WalletWisdomProps) {
    const balance = credits?.balance || 0;
    const allowance = credits?.dailyAllowance || 100;
    const used = credits?.dailyAllowanceUsed || 0;
    const remaining = Math.max(0, allowance - used);

    // Calculate percentage for circular progress
    const percentage = Math.round((remaining / allowance) * 100);
    const dashArray = 2 * Math.PI * 45; // 45 is radius
    const dashOffset = dashArray - (dashArray * percentage) / 100;

    return (
        <Card variant="glass" className="p-8 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />

            <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                {/* Visual Level 1: Circular Progress */}
                <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="96"
                            cy="96"
                            r="85"
                            className="stroke-background-secondary fill-none"
                            strokeWidth="12"
                        />
                        <circle
                            cx="96"
                            cy="96"
                            r="85"
                            className="stroke-primary fill-none transition-all duration-1000 ease-out"
                            strokeWidth="12"
                            strokeLinecap="round"
                            style={{
                                strokeDasharray: 534,
                                strokeDashoffset: 534 - (534 * percentage) / 100
                            }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-black text-primary drop-shadow-sm">{percentage}%</span>
                        <span className="text-[10px] uppercase font-black text-foreground-muted tracking-widest mt-1">Energy Level</span>
                    </div>
                </div>

                {/* Visual Level 2: Plain English Labels */}
                <div className="flex-1 space-y-6 text-center md:text-left">
                    <div>
                        <h2 className="text-3xl font-black mb-2 flex items-center justify-center md:justify-start gap-3">
                            Your Creative Energy
                            <Icons.sparkles className="text-yellow-500 animate-pulse" size={24} />
                        </h2>
                        <p className="text-xl text-foreground-muted leading-relaxed">
                            You have enough energy for <span className="text-primary font-black px-2 py-0.5 bg-primary/10 rounded-lg">{remaining} more</span> standard images today.
                        </p>
                    </div>

                    {/* Level 3: Action-Oriented Logic */}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <div className="p-4 bg-background-secondary/50 rounded-2xl border border-border/50 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                                <Icons.activity size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black text-foreground-muted tracking-widest">Next Refill</p>
                                <p className="font-bold">In about 4 hours</p>
                            </div>
                        </div>

                        <div className="p-4 bg-background-secondary/50 rounded-2xl border border-border/50 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                <Icons.plus size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black text-foreground-muted tracking-widest">Permanent Cache</p>
                                <p className="font-bold">{balance} Pro Credits</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <Button className="h-12 px-8 rounded-xl font-bold text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all border-none">
                            Start Creating Now
                        </Button>
                        <Button variant="ghost" className="h-12 px-6 rounded-xl font-bold text-foreground-muted hover:text-foreground underline decoration-primary/30 underline-offset-4">
                            How do credits work?
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
