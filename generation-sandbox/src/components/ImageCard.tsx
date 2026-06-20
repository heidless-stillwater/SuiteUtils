import React from 'react';
import { motion } from 'framer-motion';
import { GeneratedImage } from '@/lib/types';
import { fadeInUp } from '@/lib/animations';
import Tooltip from '@/components/Tooltip';
import SmartImage from '@/components/SmartImage';
import SmartVideo from '@/components/SmartVideo';
import ShareButtons from '@/components/ShareButtons';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/Icons';

export interface ImageCardProps {
    image: GeneratedImage;
    count?: number;
    variant?: 'gallery' | 'dashboard';
    selectionMode?: boolean;
    isSelected?: boolean;
    onClick?: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    deletingId?: string | null;
    className?: string;
    showFooter?: boolean;
    renderOverlay?: (image: GeneratedImage) => React.ReactNode;
    index?: number;
    dense?: boolean;
}

export default function ImageCard({
    image,
    count = 1,
    variant = 'gallery',
    selectionMode = false,
    isSelected = false,
    onClick,
    onDelete,
    deletingId,
    className = '',
    showFooter,
    renderOverlay,
    index = 0,
    dense = false
}: ImageCardProps) {
    const isDeleting = deletingId === image.id;
    const isVideo = !!(image.videoUrl || image.settings?.modality === 'video');
    const imgIsVideo = /\.(mp4|webm|mov)(\?|$)/i.test(image.imageUrl || '');
    const hasThumbnail = isVideo && !imgIsVideo;
    const isStack = count > 1;
    const showCardFooter = dense ? false : (showFooter ?? (variant === 'dashboard'));

    return (
        <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className={`group relative cursor-pointer overflow-visible ${className} ${showCardFooter ? 'rounded-2xl border border-border bg-background-secondary' : 'rounded-xl bg-background-secondary'}`}
            onClick={onClick}
        >
            {/* Selection checkbox */}
            {selectionMode && (
                <div className="absolute top-2 left-2 z-30">
                    <Tooltip content={isSelected ? 'Deselect image' : 'Select image'} position="right">
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-white/60 bg-black/30'}`}>
                            {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            )}
                        </div>
                    </Tooltip>
                </div>
            )}

            {/* Dashboard Stack Visuals (Offset) */}
            {isStack && variant === 'dashboard' && (
                <>
                    <div className="absolute top-1 left-1 right-1 bottom-0 bg-background-secondary border border-border rounded-2xl -z-10 translate-y-2 opacity-50 transition-transform group-hover:translate-y-3" />
                    <div className="absolute top-1 left-2 right-2 bottom-0 bg-background-tertiary border border-border rounded-2xl -z-20 translate-y-4 opacity-30 transition-transform group-hover:translate-y-5" />
                    <div className="absolute top-2 right-2 z-20 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        {count} images
                    </div>
                </>
            )}

            {/* Media Container */}
            <div className={`relative ${variant === 'gallery' ? 'aspect-square' : 'aspect-[4/3]'} overflow-hidden ${showCardFooter ? 'rounded-t-2xl' : 'rounded-xl'}`}>

                {/* Gallery Stack Visuals (Inset) */}
                {isStack && variant === 'gallery' && (
                    <>
                        <div className="absolute inset-0 bg-background-secondary translate-x-1 translate-y-1 rounded-xl border border-white/10" />
                        <div className="absolute inset-0 bg-background-secondary translate-x-2 translate-y-2 rounded-xl border border-white/10" />
                        <div className="absolute top-0 right-0 p-2 z-20 pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                {count}
                            </div>
                        </div>
                    </>
                )}

                {/* Main Media */}
                <div className="w-full h-full relative z-10">
                    {isVideo ? (
                        hasThumbnail ? (
                            <>
                                <SmartImage
                                    src={image.imageUrl}
                                    alt={image.prompt}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    fallbackSize="md"
                                />
                                <SmartVideo
                                    src={image.videoUrl || image.imageUrl}
                                    className="absolute inset-0 w-full h-full object-cover z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    loop
                                    muted
                                    preload="metadata"
                                    onMouseEnter={(e) => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => { }); }}
                                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                />
                            </>
                        ) : (
                            <SmartVideo
                                src={image.videoUrl || image.imageUrl}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loop
                                muted
                                preload="metadata"
                                onMouseEnter={(e) => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => { }); }}
                                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                            />
                        )
                    ) : (
                        <SmartImage
                            src={image.imageUrl}
                            alt={image.prompt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            fallbackSize="md"
                        />
                    )}

                    {/* Status Badges Container (Top Left, offset if selecting) */}
                    <div className={cn(
                        "absolute top-2 z-20 pointer-events-none flex flex-col gap-1.5 transition-all duration-300",
                        selectionMode ? "left-10" : "left-2"
                    )}>
                        {/* Community Badge */}
                        {image.publishedToCommunity && (
                            <div className="bg-yellow-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg backdrop-blur-sm w-fit">
                                🏆 Community
                            </div>
                        )}

                        {/* Exemplar Badge */}
                        {image.isExemplar && (
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg backdrop-blur-sm w-fit border border-indigo-400/30">
                                🏅 Exemplar
                            </div>
                        )}

                        {/* Variation Badge (Single Item Only) */}
                        {!isStack && image.sourceImageId && (
                            <div className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded-lg uppercase shadow-sm backdrop-blur-sm w-fit flex items-center gap-1 border border-accent-hover/40">
                                <Icons.variation size={10} />
                                <span>Variation</span>
                            </div>
                        )}
                    </div>

                    {/* Video Duration Badge */}
                    {(isVideo || image.duration) && (
                        <div className="absolute bottom-2 right-2 z-20 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg shadow-lg border border-white/10 flex items-center gap-1.5 min-w-[40px] justify-center pointer-events-none">
                            {image.duration ? (
                                <span className="text-[11px] font-bold font-mono">
                                    0:{Math.round(image.duration).toString().padStart(2, '0')}
                                </span>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </div>
                    )}
                </div>

                {/* Custom Overlay (e.g., Set Cover) */}
                {renderOverlay && (
                    <div className="absolute inset-0 z-20 pointer-events-none group-hover:pointer-events-auto">
                        {renderOverlay(image)}
                    </div>
                )}

                {/* Gallery Hover Overlay */}
                {variant === 'gallery' && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none flex flex-col justify-end p-3">
                        <p className={cn("text-sm font-semibold text-white", !image.title && "text-white/60 italic text-xs")}>
                            {image.title || '<no title>'}
                        </p>
                        <p className="text-white/90 text-xs line-clamp-2 drop-shadow-md leading-relaxed">
                            {image.prompt}
                        </p>
                        <p className="text-white/60 text-[10px] font-medium mt-1.5 drop-shadow-md uppercase tracking-wider">
                            {isStack ? `${count} Variations` : `${image.settings?.quality || 'standard'} • ${image.settings?.aspectRatio || '1:1'}`}
                        </p>
                    </div>
                )}

                {/* Delete Button (Gallery Logic - if provided and not multiselect) */}
                {onDelete && !selectionMode && (!isStack || count === 1) && (
                    <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip content="Delete image" position="left">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(e);
                                }}
                                disabled={isDeleting}
                                className="p-2 bg-black/50 hover:bg-error/80 rounded-lg backdrop-blur-sm transition-colors shadow-lg"
                            >
                                {isDeleting ? (
                                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                )}
                            </button>
                        </Tooltip>
                    </div>
                )}
            </div>

            {/* Footer Logic (Both Gallery & Dashboard) */}
            {(showCardFooter || (variant === 'gallery' && image.title)) && (
                <div className={cn(
                    "p-3 bg-background-secondary border-t border-white/5 relative z-10",
                    variant === 'gallery' ? "rounded-b-xl" : "p-4 rounded-b-2xl border-white/5"
                )}>
                    {image.title && (
                        <h3 className={cn(
                            "font-bold text-foreground-primary truncate leading-tight",
                            variant === 'gallery' ? "text-[11px] mb-0.5" : "text-sm mb-1"
                        )}>
                            {image.title}
                        </h3>
                    )}
                    {variant === 'dashboard' && (
                        <p className={cn(
                            "text-xs line-clamp-2 mb-3 text-foreground-muted group-hover:text-primary/80 transition-colors leading-relaxed",
                            !image.title && "text-sm text-foreground-primary"
                        )}>
                            {image.prompt}
                        </p>
                    )}
                    <div className="flex items-center justify-between">
                        <p className={cn(
                            "text-foreground-muted font-sans",
                            variant === 'gallery' ? "text-[9px] opacity-60" : "text-xs"
                        )}>
                            {image.settings?.quality || 'standard'} • {image.settings?.aspectRatio || '1:1'}
                        </p>
                        {!selectionMode && <ShareButtons entryId={image.communityEntryId} imageUrl={image.imageUrl} prompt={image.prompt} className="scale-75 origin-right" />}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
