'use client';

import Tooltip from '@/components/Tooltip';
import { useRouter } from 'next/navigation';
import { GeneratedImage } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface ActionsBarProps {
    image: GeneratedImage;
    publishingId: string | null;
    deletingId: string | null;
    onCopyPrompt: () => void;
    onCopySeed: () => void;
    onGenerateVariation: () => void;
    onCommunityToggle: () => void;
    onDownload: () => void;
    onDelete: () => void;
}

export default function ActionsBar({
    image,
    publishingId,
    deletingId,
    onCopyPrompt,
    onCopySeed,
    onGenerateVariation,
    onCommunityToggle,
    onDownload,
    onDelete
}: ActionsBarProps) {
    const router = useRouter();

    return (
        <div className="pt-4 border-t border-border mt-auto grid grid-cols-2 gap-2">
            <Tooltip content="Copy the original prompt text" className="flex-1">
                <Button
                    variant="secondary"
                    onClick={onCopyPrompt}
                    className="w-full text-xs py-2 flex items-center justify-center gap-2"
                >
                    Copy Prompt
                </Button>
            </Tooltip>
            <Tooltip content="Copy seed for exact reproduction" className="flex-1">
                <Button
                    variant="secondary"
                    onClick={onCopySeed}
                    disabled={!image.settings?.seed}
                    className="w-full text-xs py-2 flex items-center justify-center gap-2"
                >
                    Copy Seed
                </Button>
            </Tooltip>
            <Tooltip content="Edit this image" className="col-span-2">
                <Button
                    variant="secondary"
                    onClick={() => router.push(`/edit?imageId=${image.id}`)}
                    className="w-full text-xs py-2 flex items-center justify-center gap-2"
                >
                    <span className="text-lg">✏️</span>
                    Edit Image
                </Button>
            </Tooltip>
            <Tooltip 
                content={
                    !image.title 
                        ? 'Set an architectural title to enable community publishing' 
                        : image.publishedToCommunity 
                            ? 'Remove this fragment from the community hub' 
                            : 'Share your work with the community library'
                } 
                className="col-span-2"
            >
                <Button
                    onClick={onCommunityToggle}
                    disabled={publishingId === image.id || (!image.title && !image.publishedToCommunity)}
                    isLoading={publishingId === image.id}
                    className={cn(
                        "w-full py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                        image.publishedToCommunity
                            ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20'
                            : 'bg-background-secondary hover:bg-background-tertiary text-foreground border border-border',
                        !image.title && !image.publishedToCommunity && 'opacity-50 grayscale cursor-not-allowed'
                    )}
                >
                    {!publishingId && (
                        <span className="text-lg">🏆</span>
                    )}
                    {image.publishedToCommunity ? 'Published to Community' : 'Publish to Community'}
                </Button>
            </Tooltip>
            <Tooltip content="Get the file at full resolution" className="col-span-2">
                <Button
                    onClick={onDownload}
                    className="w-full text-xs py-2 flex items-center justify-center gap-2"
                >
                    <Icons.download size={16} />
                    Download {(image.videoUrl || image.settings?.modality === 'video') ? 'Video' : 'Image'}
                </Button>
            </Tooltip>
            <Button
                variant="danger"
                onClick={onDelete}
                disabled={deletingId === image.id}
                isLoading={deletingId === image.id}
                className="col-span-2 text-xs py-2 flex items-center justify-center gap-2 opacity-80 hover:opacity-100"
            >
                {deletingId === image.id ? 'Deleting...' : 'Delete Image'}
            </Button>
        </div>
    );
}

