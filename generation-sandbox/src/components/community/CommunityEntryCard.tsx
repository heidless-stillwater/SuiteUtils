'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CommunityEntry, BADGES } from '@/lib/types';
import UserAvatar from '@/components/UserAvatar';
import ReactionPicker from '@/components/ReactionPicker';
import ShareButtons from '@/components/ShareButtons';
import { formatTimeAgo } from '@/lib/date-utils';
import Tooltip from '@/components/Tooltip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface CommunityEntryCardProps {
    entry: CommunityEntry;
    userId?: string;
    onVote: (entryId: string) => void;
    isVoting: boolean;
    onSelect: (entryId: string) => void;
    onReact: (entryId: string, emoji: string) => void;
    reactingEmoji?: string | null;
    viewMode?: 'grid' | 'feed' | 'compact' | 'creators' | 'list';
    showCommunityPill?: boolean;
    onFilterUser?: (userId: string, userName: string) => void;
    onShare?: (entryId: string) => void;
}

export default function CommunityEntryCard({
    entry,
    userId,
    onVote,
    isVoting,
    onSelect,
    onReact,
    reactingEmoji,
    viewMode = 'grid',
    showCommunityPill = false,
    onFilterUser,
    onShare,
}: CommunityEntryCardProps) {
    const [error, setError] = useState(false);
    const hasVoted = userId ? !!entry.votes?.[userId] : false;
    const isStack = entry.isStack;
    const stackSize = entry.stackSize || 0;

    return (
        <Card className={cn(
            "group hover:ring-2 hover:ring-primary/50 transition-all hover:shadow-xl hover:shadow-primary/5",
            viewMode === 'feed' ? "rounded-3xl border-border/60" : "rounded-2xl",
            isStack ? "relative overflow-visible" : "overflow-hidden"
        )} variant="glass">
            {/* Stack shadow layers */}
            {isStack && (
                <>
                    <div className="absolute inset-x-2 -bottom-2 h-full bg-background-secondary border border-border/40 rounded-2xl z-[-1] pointer-events-none opacity-50" />
                    {stackSize > 2 && (
                        <div className="absolute inset-x-4 -bottom-4 h-full bg-background-secondary/30 border border-border/30 rounded-2xl z-[-2] pointer-events-none opacity-30" />
                    )}
                </>
            )}

            {/* Media Area */}
            <div
                className={cn(
                    "relative cursor-pointer overflow-hidden",
                    viewMode === 'feed' ? "aspect-video" : "aspect-square"
                )}
                onClick={() => onSelect(entry.id)}
                onMouseEnter={(e) => {
                    const video = e.currentTarget.querySelector('video');
                    if (video && video.paused) video.play().catch(() => { });
                }}
                onMouseLeave={(e) => {
                    const video = e.currentTarget.querySelector('video');
                    if (video) { video.pause(); video.currentTime = 0; }
                }}
            >
                {error ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-background-secondary p-4 text-foreground-muted">
                        <Icons.error className="w-10 h-10 opacity-20 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Media Unavailable</span>
                    </div>
                ) : (() => {
                    const isVidEntry = !!(entry.videoUrl || entry.settings?.modality === 'video');
                    const imgIsVideo = /\.(mp4|webm|mov)(\?|$)/i.test(entry.imageUrl || '');
                    const hasThumbnail = isVidEntry && !imgIsVideo;

                    return isVidEntry ? (
                        hasThumbnail ? (
                            <>
                                <img src={entry.imageUrl} alt={entry.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={() => setError(true)} />
                                <video src={entry.videoUrl || entry.imageUrl} className="absolute inset-0 w-full h-full object-cover z-[1] opacity-0 group-hover:opacity-100 transition-opacity duration-300" muted loop playsInline preload="metadata" onError={() => setError(true)} />
                            </>
                        ) : (
                            <video src={entry.videoUrl || entry.imageUrl} className="w-full h-full object-cover" muted loop playsInline preload="metadata" onError={() => setError(true)} />
                        )
                    ) : (
                        <img src={entry.imageUrl} alt={entry.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={() => setError(true)} />
                    );
                })()}

                {/* Community Pill */}
                {showCommunityPill && (
                    <div className={cn(
                        "absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm text-white rounded-full border border-primary/40 shadow-lg shadow-primary/20 pointer-events-none",
                        viewMode === 'compact' ? "px-1.5 py-0.5" : "px-2.5 py-1"
                    )}>
                        <Icons.trophy className={cn(viewMode === 'compact' ? "w-2.5 h-2.5" : "w-3 h-3")} />
                        {viewMode !== 'compact' && (
                            <span className="text-[9px] font-black uppercase tracking-widest">Community Hub</span>
                        )}
                    </div>
                )}

                {/* Stack Badge */}
                {isStack && (
                    <div className="absolute top-2 right-2 z-10 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10 pointer-events-none">
                        <Icons.stack className="w-3 h-3" />
                        <span className="text-[10px] font-black">{stackSize}</span>
                    </div>
                )}

                {/* Exemplar Badge */}
                {entry.isExemplar && (
                    <div className={cn(
                        "absolute z-10 flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-violet-600 backdrop-blur-sm text-white rounded-full border border-indigo-400/40 shadow-lg shadow-indigo-500/25 pointer-events-none",
                        isStack ? "top-2 left-2" : (showCommunityPill ? "top-10 left-2" : "top-2 left-2"),
                        viewMode === 'compact' ? "px-1.5 py-0.5" : "px-2.5 py-1"
                    )}>
                        <Icons.exemplar className={cn(viewMode === 'compact' ? "w-2.5 h-2.5" : "w-3 h-3")} />
                        {viewMode !== 'compact' && (
                            <span className="text-[9px] font-black uppercase tracking-widest">Exemplar</span>
                        )}
                    </div>
                )}

                {/* Video Badge */}
                {(entry.videoUrl || entry.settings?.modality === 'video') && (
                    <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg shadow-lg border border-white/10 flex items-center gap-1.5 pointer-events-none">
                        {entry.duration ? (
                            <span className="text-[11px] font-bold font-mono">
                                0:{Math.round(entry.duration).toString().padStart(2, '0')}
                            </span>
                        ) : (
                            <Icons.sparkles className="w-3.5 h-3.5" />
                        )}
                    </div>
                )}

                {/* Prompt Overlay */}
                <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity",
                    viewMode === 'compact' ? "opacity-0 group-hover:opacity-100" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                )}>
                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                        {/* Title on Hover */}
                        <div className="pb-1 border-b border-white/10">
                            <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Neural Identity</p>
                            <p className="text-[10px] font-black text-white uppercase truncate">
                                {entry.title || '<no title>'}
                            </p>
                        </div>
                        <p className={cn(
                            "text-white/80 leading-snug",
                            viewMode === 'compact' ? "text-[10px] line-clamp-1" : "text-[11px] line-clamp-2"
                        )}>{entry.prompt}</p>
                    </div>
                </div>

            </div>

            {/* Content Area */}
            <div className={cn(
                "p-4 space-y-4",
                viewMode === 'compact' && "p-2 space-y-1"
            )}>
                {/* Title Display */}
                {viewMode !== 'compact' && (
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors truncate uppercase tracking-tight">
                            {entry.title || '<no title>'}
                        </h3>
                    </div>
                )}

                {/* Author Info */}
                <div className="flex items-center justify-between">
                    <Link
                        href={`/profile/${entry.originalUserId}`}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity group/author overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <UserAvatar 
                            src={entry.authorPhotoURL} 
                            name={entry.authorName} 
                            size={viewMode === 'compact' ? 'sm' : 'md'}
                            className="group-hover/author:border-primary/50 transition-colors"
                        />
                        <span className={cn(
                            "font-medium truncate group-hover/author:text-primary transition-colors",
                            viewMode === 'compact' ? "text-[10px]" : "text-sm"
                        )}>
                            {entry.authorName}
                        </span>
                    </Link>

                    {onFilterUser && viewMode !== 'compact' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onFilterUser(entry.originalUserId, entry.authorName);
                            }}
                            className="p-1.5 hover:bg-primary/20 bg-background-secondary/50 rounded-lg text-foreground-muted hover:text-primary transition-all opacity-0 group-hover:opacity-100 ml-1 shadow-sm border border-transparent hover:border-primary/30"
                            title={`Filter feed by ${entry.authorName}`}
                        >
                            <Icons.filter size={14} />
                        </button>
                    )}

                    <span className={cn(
                        "text-foreground-muted whitespace-nowrap ml-auto",
                        viewMode === 'compact' ? "text-[8px]" : "text-xs"
                    )}>
                        {formatTimeAgo(entry.publishedAt)}
                    </span>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Tooltip content={hasVoted ? 'Remove vote' : 'Vote'}>
                            <Button
                                onClick={(e) => { e.stopPropagation(); onVote(entry.id); }}
                                isLoading={isVoting}
                                size="sm"
                                variant={hasVoted ? 'primary' : 'outline'}
                                className={cn("font-bold", viewMode === 'compact' ? "h-6 px-1.5 text-[10px]" : "gap-1.5")}
                            >
                                <Icons.heart className={hasVoted ? 'fill-current' : ''} size={viewMode === 'compact' ? 12 : 16} />
                                <span>{entry.voteCount}</span>
                            </Button>
                        </Tooltip>

                        <Tooltip content="Comments">
                            <Button
                                onClick={() => onSelect(entry.id)}
                                size="sm"
                                variant="outline"
                                className={cn("text-foreground-muted", viewMode === 'compact' ? "h-6 px-1.5 text-[10px]" : "gap-1.5")}
                            >
                                <Icons.comment size={viewMode === 'compact' ? 12 : 16} />
                                <span>{entry.commentCount}</span>
                            </Button>
                        </Tooltip>

                        {(entry.variationCount || 0) > 0 && (
                            <Tooltip content="Community variations">
                                <div className={cn("flex items-center text-foreground-muted", viewMode === 'compact' ? "text-[10px] gap-1" : "gap-1.5")}>
                                    <Icons.variation size={viewMode === 'compact' ? 12 : 16} className="text-blue-400" />
                                    <span>{entry.variationCount}</span>
                                </div>
                            </Tooltip>
                        )}
                    </div>

                    {viewMode !== 'compact' && (
                        <ShareButtons
                            imageUrl={entry.imageUrl}
                            prompt={entry.prompt}
                            entryId={entry.id}
                            onShare={onShare}
                            className="scale-75 origin-right"
                        />
                    )}
                </div>

                {/* Reactions */}
                {viewMode !== 'compact' && (
                    <div className="pt-2 border-t border-border/50">
                        <ReactionPicker
                            entryId={entry.id}
                            reactions={entry.reactions || {}}
                            onReact={(emoji) => onReact(entry.id, emoji)}
                            isReactingEmoji={reactingEmoji}
                        />
                    </div>
                )}
            </div>
        </Card >
    );
}
