'use client';

import React, { useState } from 'react';
import { Icons } from '@/components/ui/Icons';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Tooltip from '@/components/Tooltip';
import { ImageQuality, AspectRatio, MediaModality, CREDIT_COSTS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
    modality: MediaModality;
    setModality: (modality: MediaModality) => void;
    quality: ImageQuality | 'video';
    setQuality: (quality: ImageQuality) => void;
    aspectRatio: AspectRatio;
    setAspectRatio: (aspectRatio: AspectRatio) => void;
    batchSize: number;
    setBatchSize: (size: number) => void;
    promptSetID: string;
    setPromptSetID: (id: string) => void;
    onGenerateSetID: () => void;
    allowedQualities: string[];
    isPro: boolean;
    isCasual: boolean;
}

export default function SettingsSection({
    modality,
    setModality,
    quality,
    setQuality,
    aspectRatio,
    setAspectRatio,
    batchSize,
    setBatchSize,
    promptSetID,
    setPromptSetID,
    onGenerateSetID,
    allowedQualities,
    isPro,
    isCasual
}: SettingsSectionProps) {
    const [isCoreOpen, setIsCoreOpen] = useState(false);

    return (
        <Card id="settings-panel" className="p-0 overflow-hidden" variant="glass">
            <button
                onClick={() => setIsCoreOpen(!isCoreOpen)}
                className="w-full flex items-center justify-between p-5 group hover:bg-background-secondary/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl transition-all shadow-sm",
                        isCoreOpen ? "bg-primary text-white shadow-primary/20" : "bg-primary/10 text-primary"
                    )}>
                        <Icons.stack size={18} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-black uppercase tracking-widest">{isCasual ? 'Style & Size' : 'Core Settings'}</h3>
                        <p className="text-[10px] text-foreground-muted uppercase tracking-widest mt-0.5">Define your output</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Icons.chevronRight size={20} className={cn("transition-transform duration-500 text-foreground-muted", isCoreOpen ? "rotate-90 text-primary" : "")} />
                </div>
            </button>

            <div className={cn(
                "transition-all duration-500 ease-in-out overflow-hidden px-5",
                isCoreOpen ? "max-h-[800px] pb-6 opacity-100 border-t border-border/50" : "max-h-0 opacity-0"
            )}>
                <div className="pt-6 space-y-6">
                    <div className="flex bg-background-secondary p-1 rounded-xl border border-border">
                        <button
                            onClick={() => setModality('image')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                modality === 'image' ? "bg-background shadow-md text-primary" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Icons.image size={12} />
                            Image
                        </button>
                        <button
                            onClick={() => setModality('video')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                modality === 'video' ? "bg-background shadow-md text-primary" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Icons.video size={12} />
                            Video
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1 flex items-center gap-2">
                                {isCasual ? 'Image Quality' : 'Output Quality'}
                                <Tooltip content="Higher quality creates more detail but costs more credits" position="top">
                                    <Icons.info size={12} className="text-foreground-muted" />
                                </Tooltip>
                            </label>
                            <Select
                                value={quality}
                                onChange={(e) => setQuality(e.target.value as ImageQuality)}
                                disabled={modality === 'video'}
                                className="h-11"
                            >
                                {modality === 'video' ? (
                                    <option value="video">Cinematic Video (5s)</option>
                                ) : (
                                    <>
                                        <option value="standard" disabled={!allowedQualities.includes('standard')}>
                                            Standard HD — {CREDIT_COSTS.standard} credit
                                        </option>
                                        <option value="high" disabled={!allowedQualities.includes('high')}>
                                            High Definition (2K) — {CREDIT_COSTS.high} credits
                                        </option>
                                        <option value="ultra" disabled={!allowedQualities.includes('ultra')}>
                                            Ultra 4K — {CREDIT_COSTS.ultra} credits {!allowedQualities.includes('ultra') ? '(Pro only)' : ''}
                                        </option>
                                    </>
                                )}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1 flex items-center gap-2">
                                {isCasual ? 'Image Shape' : 'Aspect Ratio'}
                                <Tooltip content="Choose the dimensions of your generated media" position="top">
                                    <Icons.info size={12} className="text-foreground-muted" />
                                </Tooltip>
                            </label>
                            <Select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                className="h-11"
                            >
                                <option value="1:1">{isCasual ? 'Square' : '1:1 (Square)'}</option>
                                <option value="4:3">{isCasual ? 'Landscape' : '4:3 (Classic)'}</option>
                                <option value="3:4">{isCasual ? 'Portrait' : '3:4 (Portrait)'}</option>
                                <option value="16:9">{isCasual ? 'Wide' : '16:9 (Cinematic)'}</option>
                                <option value="9:16">{isCasual ? 'Story' : '9:16 (Tall)'}</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80 ml-1 flex items-center gap-2">
                            Prompt Set Identifier
                            <Tooltip content="Group multiple generations under a single ID for better organization in your gallery" position="top">
                                <Icons.info size={12} className="text-foreground-muted" />
                            </Tooltip>
                        </label>
                        <div className="flex gap-2">
                            <Input
                                value={promptSetID}
                                onChange={(e) => setPromptSetID(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                                placeholder="Group name or ID..."
                                maxLength={30}
                                className="h-11 text-sm bg-background-secondary text-foreground font-medium"
                            />
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={onGenerateSetID}
                                className="h-11 w-11 shadow-sm"
                            >
                                <Icons.history size={18} />
                            </Button>
                        </div>
                    </div>

                    {isPro && modality === 'image' && (
                        <div className="pt-6 border-t border-border/50">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-foreground ml-1">Batch Size</label>
                                <Badge variant="primary" size="sm" className="bg-primary/10 text-primary border-0">Pro Feature</Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 4, 8, 12].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => setBatchSize(size)}
                                        className={cn(
                                            "py-2.5 rounded-xl text-xs font-black transition-all border shadow-sm",
                                            batchSize === size
                                                ? "bg-primary border-primary text-white shadow-primary/20"
                                                : "bg-background-secondary text-foreground-muted border-border hover:border-primary/50"
                                        )}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {modality === 'video' && (
                        <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <div className="bg-orange-500/10 p-2 rounded-lg">
                                    <Icons.video size={16} className="text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-orange-700">Cinematic Video Mode</p>
                                    <p className="text-[11px] text-orange-600 mt-0.5 leading-relaxed">
                                        This will generate a high-quality 5-second cinematic clip. Estimated time: ~45 seconds.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
