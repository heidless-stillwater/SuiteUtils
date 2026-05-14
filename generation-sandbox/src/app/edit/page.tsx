'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { doc, getDoc, addDoc, collection, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GeneratedImage } from '@/lib/types';
import ImageEditor from '@/components/ImageEditor';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';

function EditPageContent() {
    const { user, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const imageId = searchParams.get('imageId');
    const { showToast } = useToast();

    const [image, setImage] = useState<GeneratedImage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        }
    }, [user, authLoading, router]);

    // Fetch the image
    useEffect(() => {
        async function fetchImage() {
            if (!user || !imageId) {
                setError('No image specified');
                setLoading(false);
                return;
            }

            try {
                const imgRef = doc(db, 'users', user.uid, 'images', imageId);
                const imgSnap = await getDoc(imgRef);

                if (!imgSnap.exists()) {
                    setError('Image not found');
                    setLoading(false);
                    return;
                }

                setImage({ id: imgSnap.id, ...imgSnap.data() } as GeneratedImage);
            } catch (err) {
                console.error('[Edit] Error fetching image:', err);
                setError('Failed to load image');
            } finally {
                setLoading(false);
            }
        }

        if (user && imageId) {
            fetchImage();
        }
    }, [user, imageId]);

    const handleSave = async (dataUrl: string, saveAsNew: boolean) => {
        if (!user || !image) return;

        try {
            // Convert dataUrl to blob for upload
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
            });
            reader.readAsDataURL(blob);
            const base64Data = await base64Promise;

            // Upload via API
            const token = await user.getIdToken();
            const uploadRes = await fetch('/api/edit/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    imageData: base64Data,
                    mimeType: 'image/png',
                    originalImageId: image.id,
                    saveAsNew,
                    prompt: image.prompt,
                    promptSetID: image.promptSetID,
                    settings: image.settings,
                    collectionIds: image.collectionIds || (image.collectionId ? [image.collectionId] : []),
                }),
            });

            const result = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(result.error);

            showToast(
                saveAsNew ? 'Saved as new image in your gallery!' : 'Image updated successfully!',
                'success'
            );

            // Navigate back to gallery
            router.push('/gallery');
        } catch (err: any) {
            console.error('[Edit] Save error:', err);
            showToast(err.message || 'Failed to save image', 'error');
        }
    };

    const handleClose = () => {
        router.back();
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-foreground-muted font-medium animate-pulse">Loading editor...</p>
                </div>
            </div>
        );
    }

    if (error || !image) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <div className="text-6xl">❌</div>
                    <p className="text-foreground-muted">{error || 'Image not found'}</p>
                    <Button onClick={() => router.push('/gallery')} className="px-6 py-2">
                        Back to Gallery
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <ImageEditor
            imageUrl={image.imageUrl}
            imageId={image.id}
            onClose={handleClose}
            onSave={handleSave}
        />
    );
}

export default function EditPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        }>
            <EditPageContent />
        </Suspense>
    );
}
