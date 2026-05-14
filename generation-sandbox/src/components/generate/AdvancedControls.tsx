'use client';

import { Icons } from '@/components/ui/Icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Tooltip from '@/components/Tooltip';
import { cn } from '@/lib/utils';

interface AdvancedControlsProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    negativePrompt: string;
    setNegativePrompt: (p: string) => void;
    seed: number | undefined;
    setSeed: (s: number | undefined) => void;
    guidanceScale: number;
    setGuidanceScale: (g: number) => void;
    isCasual: boolean;
}

export default function AdvancedControls({
    isOpen,
    setIsOpen,
    negativePrompt,
    setNegativePrompt,
    seed,
    setSeed,
    guidanceScale,
    setGuidanceScale,
    isCasual
}: AdvancedControlsProps) {
    if (isCasual) return null;

    return (
        <Card className="overflow-hidden p-0" variant="glass">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 group hover:bg-background-secondary/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl transition-all shadow-sm",
                        isOpen ? "bg-primary text-white shadow-primary/20" : "bg-primary/10 text-primary"
                    )}>
                        <Icons.settings size={18} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-black uppercase tracking-widest">Precision Tuning</h3>
                        <p className="text-[10px] text-foreground-muted uppercase tracking-widest mt-0.5">Control the finer details</p>
                    </div>
                </div>
                <Icons.arrowRight size={20} className={cn("transition-transform duration-500 text-foreground-muted", isOpen ? "rotate-90 text-primary" : "")} />
            </button>

            <div className={cn(
                "transition-all duration-500 ease-in-out overflow-hidden px-5",
                isOpen ? "max-h-[600px] pb-6 opacity-100 border-t border-border/50" : "max-h-0 opacity-0"
            )}>
                <div className="pt-6 space-y-6">
                    {/* Negative Prompt */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                Negative Prompt
                                <Tooltip content="Describe what you DON'T want in the image (e.g. 'blurry, distorted')">
                                    <Icons.info size={12} />
                                </Tooltip>
                            </span>
                            <span className="text-primary/70">What to exclude</span>
                        </label>
                        <textarea
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="blurry, distorted, low quality, text, watermarks, signature..."
                            className="w-full rounded-xl bg-background-secondary border border-border text-foreground transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-foreground-muted h-24 text-sm resize-none py-3 px-4 italic leading-relaxed"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Seed Control */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    Seed
                                    <Tooltip content="Fixed seeds ensure consistent results for the same prompt">
                                        <Icons.info size={12} />
                                    </Tooltip>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSeed(undefined)}
                                    className={cn(
                                        "text-[9px] uppercase font-black tracking-widest transition-all px-2 py-0.5 rounded-full border",
                                        seed === undefined ? "bg-primary/10 text-primary border-primary/20" : "text-foreground-muted border-border hover:border-foreground-muted"
                                    )}
                                >
                                    {seed === undefined ? '✓ Random' : 'Randomize'}
                                </button>
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={seed ?? ''}
                                    onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                                    placeholder="Random"
                                    className="h-11 text-sm bg-background-secondary text-foreground font-medium"
                                />
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                                    className="h-11 w-11 shadow-sm"
                                >
                                    <Icons.history size={18} />
                                </Button>
                            </div>
                        </div>

                        {/* Guidance Scale */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    Guidance Scale
                                    <Tooltip content="Higher values follow prompt more strictly but may look overcooked">
                                        <Icons.info size={12} />
                                    </Tooltip>
                                </span>
                                <span className="text-primary font-black">{guidanceScale.toFixed(1)}</span>
                            </label>
                            <div className="px-1 pt-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    step="0.5"
                                    value={guidanceScale}
                                    onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-background-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-foreground-muted mt-3">
                                    <span>Creative</span>
                                    <span>Strict</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
