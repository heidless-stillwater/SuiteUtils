
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc, increment, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { GeneratedImage } from '@/lib/types';

interface UseImageActionsOptions {
    onDelete?: (imageId: string) => void;
}

export function useImageActions(image?: GeneratedImage, options: UseImageActionsOptions = {}) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const copyPrompt = async (promptText?: string) => {
        const text = promptText || image?.prompt;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Prompt copied to clipboard', 'success');
        } catch (err) {
            showToast('Failed to copy prompt', 'error');
        }
    };

    const copySeed = async (seed?: number | string) => {
        const text = seed?.toString() || image?.settings?.seed?.toString();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Seed copied to clipboard', 'success');
        } catch (err) {
            showToast('Failed to copy seed', 'error');
        }
    };

    const downloadImage = async (imgUrl?: string, imgId?: string) => {
        const url = imgUrl || image?.imageUrl;
        const id = imgId || image?.id;

        if (!url) return;

        setIsDownloading(true);
        try {
            const filename = `studio-image-${id || 'download'}.png`;
            // Using the proxy API to avoid CORS issues and handle renaming
            const proxyUrl = `/api/download/?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

            const link = document.createElement('a');
            link.href = proxyUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (user && id) {
                // Track download count if authenticated
                // Fire and forget update
                const imageRef = doc(db, 'users', user.uid, 'images', id);
                updateDoc(imageRef, {
                    downloadCount: increment(1)
                }).catch(e => console.error("Failed to track download", e));
            }
            showToast('Download started', 'success');
        } catch (error) {
            console.error('Download error:', error);
            // Fallback
            window.open(url, '_blank');
        } finally {
            setIsDownloading(false);
        }
    };

    const deleteImage = async (imgId?: string, skipConfirm = false) => {
        const id = imgId || image?.id;
        if (!id || !user) return;

        if (!skipConfirm && !window.confirm('Are you sure you want to delete this image?')) {
            return;
        }

        setIsDeleting(true);
        try {
            // 1. Delete the image document
            await deleteDoc(doc(db, 'users', user.uid, 'images', id));

            // 2. We should ideally cleanup collection counts, but that requires knowing which collections it was in.
            // If the caller handles state updates, they might handle collection counts too.
            // For now, we'll focus on the image deletion itself.
            // A more robust backend trigger would be better for count consistency.

            if (options.onDelete) {
                options.onDelete(id);
            }
            showToast('Image deleted', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete image', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const shareToTwitter = (imgUrl?: string, promptText?: string) => {
        const url = imgUrl || image?.imageUrl;
        const text = promptText || image?.prompt;
        if (!url || !text) return;

        const shareText = `Check out this AI art I generated! 🎨✨\n\nPrompt: "${text.length > 100 ? text.substring(0, 97) + '...' : text}"\n\n`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    };

    const shareToReddit = (imgUrl?: string, promptText?: string) => {
        const url = imgUrl || image?.imageUrl;
        const text = promptText || image?.prompt;
        if (!url || !text) return;

        const title = `AI Art: ${text.length > 50 ? text.substring(0, 47) + '...' : text}`;
        const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        window.open(redditUrl, '_blank', 'width=800,height=600');
    };

    return {
        copyPrompt,
        copySeed,
        downloadImage,
        deleteImage,
        shareToTwitter,
        shareToReddit,
        isDeleting,
        isDownloading
    };
}
