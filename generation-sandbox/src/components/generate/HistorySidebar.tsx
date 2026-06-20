'use client';

import { GeneratedImage } from '@/lib/types';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    images: GeneratedImage[];
    loading: boolean;
    onRemix: (image: GeneratedImage) => void;
}

export default function HistorySidebar({
    isOpen,
    onClose,
    images,
    loading,
    onRemix
}: HistorySidebarProps) {
    return (
        <div className={cn(
            "fixed inset-0 z-[100] transition-opacity duration-300",
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className={cn(
                "absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-background border-l border-border transition-transform duration-500 ease-out flex flex-col shadow-2xl",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Recent History</h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Your latest creations</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                    >
                        <Icons.close size={20} />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                    {loading && images.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-foreground-muted gap-4">
                            <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-xs font-medium animate-pulse">Retrieving history...</p>
                        </div>
                    ) : images.length === 0 ? (
                        <div className="text-center py-12 px-6">
                            <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-4">
                                <Icons.history className="w-8 h-8 text-foreground-muted opacity-20" />
                            </div>
                            <h3 className="text-sm font-bold mb-1">No generations yet</h3>
                            <p className="text-xs text-foreground-muted">Create something to see it here!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {images.map((img) => (
                                <Card
                                    key={img.id}
                                    className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-all p-2 flex flex-col gap-2"
                                >
                                    <div className="aspect-square rounded-lg overflow-hidden bg-background-secondary relative group/media">
                                        {/\.(mp4|webm|mov)(\?|$)/i.test(img.imageUrl) ? (
                                            <video
                                                src={`${img.imageUrl}#t=0.1`}
                                                className="w-full h-full object-cover"
                                                preload="metadata"
                                                muted
                                                playsInline
                                            />
                                        ) : (
                                            <img
                                                src={img.imageUrl}
                                                alt={img.prompt}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover/media:scale-110"
                                            />
                                        )}
                                        {(img.settings?.modality === 'video' || img.videoUrl) && (
                                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg text-white shadow-lg border border-white/10">
                                                <Icons.video size={12} className="text-white" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => onRemix(img)}
                                                className="font-bold scale-90 group-hover/media:scale-100 transition-transform"
                                            >
                                                Remix
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="px-1">
                                        <h4 className={cn("text-[11px] font-black uppercase tracking-tight mb-1 line-clamp-1", !img.title ? "text-foreground-muted italic" : "text-foreground")}>
                                            {img.title || '<no title>'}
                                        </h4>
                                        <p className="text-[10px] text-foreground-muted line-clamp-2 italic mb-2 leading-relaxed">
                                            &quot;{img.prompt}&quot;
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <Badge variant="primary" size="sm" className="bg-primary/10 text-primary border-primary/20">
                                                {img.settings?.quality || 'standard'}
                                            </Badge>
                                            <span className="text-[9px] font-medium text-foreground-muted uppercase tracking-tighter">
                                                {img.createdAt?.toDate?.() ? new Date(img.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
