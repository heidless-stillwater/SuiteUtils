'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GeneratedImage } from '@/lib/types';
import ShareButtons from '@/components/ShareButtons';
import ImageCard from '@/components/ImageCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

import { SkeletonGrid } from '@/components/ui/Skeleton';

interface RecentCreationsProps {
    title?: string;
    images: GeneratedImage[];
    loading: boolean;
    isGrouped: boolean;
    setIsGrouped: (val: boolean) => void;
    selectionMode: boolean;
    toggleSelectionMode: () => void;
    selectedIds: Set<string>;
    toggleImageSelection: (id: string, e?: React.MouseEvent) => void;
    toggleImageGroupSelection: (ids: string[], e?: React.MouseEvent) => void;
    groupImagesByPromptSet: (images: GeneratedImage[]) => Record<string, GeneratedImage[]>;
    dense?: boolean;
}

export default function RecentCreations({
    title = "Recent Creations",
    images,
    loading,
    isGrouped,
    setIsGrouped,
    selectionMode,
    toggleSelectionMode,
    selectedIds,
    toggleImageSelection,
    toggleImageGroupSelection,
    groupImagesByPromptSet,
    dense = false
}: RecentCreationsProps) {
    const router = useRouter();

    if (loading) {
        return <SkeletonGrid count={4} columns={3} />;
    }

    if (images.length === 0) {
        return (
            <Card className="text-center py-16">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold mb-2">No images yet</h3>
                <p className="text-foreground-muted mb-6">Create your first AI-generated masterpiece!</p>
                <Link href="/generate">
                    <Button variant="primary">
                        Start Creating
                    </Button>
                </Link>
            </Card>
        );
    }

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">{title}</h2>
                    <div className="flex bg-background-secondary rounded-xl p-1 border border-border/50">
                        <Button
                            variant={selectionMode ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={toggleSelectionMode}
                            className={cn(
                                "rounded-lg text-[10px] h-7 font-black tracking-widest uppercase",
                                selectionMode ? "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            Select
                        </Button>
                        <div className="w-px h-4 bg-border mx-1 self-center" />
                        <Button
                            variant={!isGrouped ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setIsGrouped(false)}
                            className={cn(
                                "rounded-lg text-[10px] h-7 font-black tracking-widest uppercase",
                                !isGrouped ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Icons.grid size={12} className="mr-1" />
                            Grid
                        </Button>
                        <Button
                            variant={isGrouped ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setIsGrouped(true)}
                            className={cn(
                                "rounded-lg text-[10px] h-7 font-black tracking-widest uppercase",
                                isGrouped ? "shadow-lg shadow-primary/20" : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Icons.stack size={12} className="mr-1" />
                            Grouped
                        </Button>
                    </div>
                </div>
                <Link href="/gallery">
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary-hover font-bold group">
                        Gallery
                        <Icons.arrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </div>

            <div className={cn(
                "grid gap-4",
                dense ? "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            )}>
                {isGrouped ? (
                    Object.entries(groupImagesByPromptSet(images)).map(([key, groupImages], index) => {
                        const firstImage = groupImages[0];
                        const groupIds = groupImages.map(img => img.id);
                        const isAnySelected = groupIds.some(id => selectedIds.has(id));
                        const isAnyPublished = groupImages.some(img => img.publishedToCommunity || img.publishedToLeague);
                        
                        const displayImage = {
                            ...firstImage,
                            publishedToCommunity: firstImage.publishedToCommunity || isAnyPublished
                        };

                        return (
                            <ImageCard
                                key={key}
                                image={displayImage}
                                count={groupImages.length}
                                variant={dense ? 'gallery' : 'dashboard'}
                                dense={dense}
                                selectionMode={selectionMode}
                                isSelected={isAnySelected}
                                index={index}
                                onClick={() => {
                                    if (selectionMode) {
                                        toggleImageGroupSelection(groupIds);
                                    } else {
                                        router.push(`/gallery?set=${firstImage.promptSetID || firstImage.id}`);
                                    }
                                }}
                                showFooter={!dense}
                            />
                        );
                    })
                ) : (
                    images.map((image, index) => (
                        <ImageCard
                            key={image.id}
                            image={image}
                            variant={dense ? 'gallery' : 'dashboard'}
                            dense={dense}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(image.id)}
                            index={index}
                            onClick={() => {
                                if (selectionMode) {
                                    toggleImageSelection(image.id);
                                } else {
                                    router.push(`/gallery?imageId=${image.id}`);
                                }
                            }}
                            showFooter={!dense}
                        />
                    ))
                )}
            </div>
        </section>
    );
}
