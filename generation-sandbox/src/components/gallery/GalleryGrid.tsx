'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedImage } from '@/lib/types';
import { useRouter } from 'next/navigation';
import ImageCard from '@/components/ImageCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import { staggerContainer, cardFadeIn } from '@/lib/animations';

interface GalleryGridProps {
    images: GeneratedImage[];
    filteredImages: GeneratedImage[];
    loadingImages: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    isGrouped: boolean;
    gridDensity: number;
    groupImagesByPromptSet: (images: GeneratedImage[]) => Record<string, GeneratedImage[]>;

    onLoadMore: () => void;
    selectionMode: boolean;
    selectedImageIds: Set<string>;
    deletingId: string | null;
    onImageSelect: (image: GeneratedImage) => void;
    onGroupSelect: (images: GeneratedImage[]) => void;
    onToggleImageSelection: (id: string, e?: React.MouseEvent) => void;
    onToggleGroupSelection: (ids: string[]) => void;
    onDeleteImage: (id: string) => void;
    onClearFilters: () => void;
}

export default function GalleryGrid({
    images,
    filteredImages,
    loadingImages,
    loadingMore,
    hasMore,
    isGrouped,
    gridDensity,
    groupImagesByPromptSet,

    onLoadMore,
    selectionMode,
    selectedImageIds,
    deletingId,
    onImageSelect,
    onGroupSelect,
    onToggleImageSelection,
    onToggleGroupSelection,
    onDeleteImage,
    onClearFilters
}: GalleryGridProps) {
    const router = useRouter();

    if (loadingImages) {
        return (
            <AnimatePresence>
                <motion.div
                    key="gallery-skeleton"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <SkeletonGrid count={10} columns={5} />
                </motion.div>
            </AnimatePresence>
        );
    }

    if (images.length === 0) {
        return (
            <Card variant="glass" className="flex flex-col items-center justify-center py-20 text-center bg-background-secondary/20 border-dashed border-2">
                <div className="w-20 h-20 rounded-full bg-background-secondary flex items-center justify-center mb-6">
                    <Icons.image className="w-10 h-10 text-foreground-muted opacity-20" />
                </div>
                <h3 className="text-xl font-bold mb-2">No images yet</h3>
                <p className="text-foreground-muted mb-8 max-w-xs">
                    You haven&apos;t generated any images yet. Start creating to populate your gallery!
                </p>
                <Button variant="primary" onClick={() => router.push('/generate')} className="gap-2 font-bold">
                    <Icons.plus size={18} />
                    Create First Image
                </Button>
            </Card>
        );
    }

    if (filteredImages.length === 0) {
        return (
            <Card variant="glass" className="flex flex-col items-center justify-center py-20 text-center bg-background-secondary/20 border-dashed border-2">
                <div className="w-20 h-20 rounded-full bg-background-secondary flex items-center justify-center mb-6">
                    <Icons.search className="w-10 h-10 text-foreground-muted opacity-20" />
                </div>
                <h3 className="text-xl font-bold mb-2">No results found</h3>
                <p className="text-foreground-muted mb-8 max-w-xs">
                    We couldn&apos;t find any images matching your current filters.
                </p>
                <Button variant="secondary" onClick={onClearFilters} className="font-bold">
                    Clear All Filters
                </Button>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            <motion.div
                className={
                    gridDensity === 2 ? "grid grid-cols-2 gap-6" :
                    gridDensity === 3 ? "grid grid-cols-2 md:grid-cols-3 gap-6" :
                    gridDensity === 5 ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6" :
                    gridDensity === 6 ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6" :
                    "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" // Default 4C
                }
                variants={staggerContainer}

                initial="initial"
                animate="animate"
            >
                {isGrouped ? (
                    Object.entries(groupImagesByPromptSet(filteredImages)).map(([key, groupImages], index) => {
                        const firstImage = groupImages[0];
                        const groupIds = groupImages.map(img => img.id);
                        const isAnySelected = groupIds.some(id => selectedImageIds.has(id));
                        const isAnyPublished = groupImages.some(img => img.publishedToCommunity || img.publishedToLeague);
                        
                        const displayImage = {
                            ...firstImage,
                            publishedToCommunity: firstImage.publishedToCommunity || isAnyPublished
                        };

                        return (
                            <motion.div key={key} variants={cardFadeIn}>
                                <ImageCard
                                    image={displayImage}
                                    count={groupImages.length}
                                    variant="gallery"
                                    selectionMode={selectionMode}
                                    isSelected={isAnySelected}
                                    index={index}
                                    onClick={() => {
                                        if (selectionMode) {
                                            onToggleGroupSelection(groupIds);
                                        } else {
                                            onGroupSelect(groupImages);
                                        }
                                    }}
                                />
                            </motion.div>
                        );
                    })
                ) : (
                    filteredImages.map((image, index) => (
                        <motion.div key={image.id} variants={cardFadeIn}>
                            <ImageCard
                                image={image}
                                variant="gallery"
                                selectionMode={selectionMode}
                                isSelected={selectedImageIds.has(image.id)}
                                index={index}
                                onClick={() => {
                                    if (selectionMode) {
                                        onToggleImageSelection(image.id);
                                    } else {
                                        onImageSelect(image);
                                    }
                                }}
                                onDelete={() => onDeleteImage(image.id)}
                                deletingId={deletingId}
                            />
                        </motion.div>
                    ))
                )}
            </motion.div>

            {hasMore && (
                <div className="flex justify-center pt-8">
                    <Button
                        variant="secondary"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="min-w-[200px] h-12 font-bold shadow-lg shadow-background-secondary/50"
                        isLoading={loadingMore}
                    >
                        Load More Creations
                    </Button>
                </div>
            )}
        </div>
    );
}
