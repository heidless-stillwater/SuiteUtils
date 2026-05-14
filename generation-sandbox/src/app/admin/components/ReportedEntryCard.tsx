'use client';

import { LeagueEntry } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface ReportedEntryCardProps {
    entry: LeagueEntry;
    isActioning: boolean;
    onAction: (action: 'dismiss' | 'remove') => void;
}

export function ReportedEntryCard({ entry, isActioning, onAction }: ReportedEntryCardProps) {
    return (
        <Card variant="glass" className="rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-lg hover:shadow-xl transition-shadow border-border/50 group">
            {/* Image Preview */}
            <div className="md:w-64 lg:w-80 aspect-square bg-background-secondary relative overflow-hidden flex-shrink-0">
                {(() => {
                    const isVid = !!(entry.videoUrl || entry.settings?.modality === 'video');
                    if (isVid) {
                        return <video src={entry.videoUrl || entry.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" muted loop playsInline preload="metadata" />;
                    }
                    return <img src={entry.imageUrl} alt={entry.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />;
                })()}
                <div className="absolute top-4 left-4 bg-error text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    {entry.reportCount} Reports
                </div>
            </div>

            {/* Content Info */}
            <div className="flex-1 p-8 flex flex-col justify-between min-w-0">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {entry.authorPhotoURL ? (
                                <img src={entry.authorPhotoURL} alt="" className="w-9 h-9 rounded-full border border-border object-cover" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary border border-primary/20">
                                    {entry.authorName?.charAt(0) || 'U'}
                                </div>
                            )}
                            <div>
                                <p className="font-bold text-sm tracking-tight">{entry.authorName}</p>
                                <p className="text-[10px] text-foreground-muted uppercase tracking-widest font-black opacity-60">Contributor</p>
                            </div>
                        </div>
                        <Link
                            href={`/profile/${entry.originalUserId}`}
                            target="_blank"
                            className="text-primary hover:underline text-[10px] font-black uppercase tracking-widest"
                        >
                            View Profile ↗
                        </Link>
                    </div>

                    <div className="bg-background-secondary/50 rounded-2xl p-5 border border-border/30 relative">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <span className="text-4xl">💬</span>
                        </div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-foreground-muted block mb-2 opacity-60">Prompt</label>
                        <p className="text-sm italic leading-relaxed text-foreground/90 line-clamp-3 font-medium">&quot;{entry.prompt}&quot;</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border/50">
                    <Button
                        variant="secondary"
                        onClick={() => onAction('dismiss')}
                        disabled={isActioning}
                        className="flex-1 text-[10px] font-black uppercase tracking-widest h-11 hover:bg-success/10 hover:text-success hover:border-success/30 transition-all"
                        isLoading={isActioning}
                    >
                        Dismiss Reports
                    </Button>
                    <Button
                        onClick={() => onAction('remove')}
                        disabled={isActioning}
                        className="flex-1 bg-error hover:bg-error-hover text-white h-11 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-error/20"
                        isLoading={isActioning}
                    >
                        🚫 Remove Entry
                    </Button>
                </div>
            </div>
        </Card>
    );
}
