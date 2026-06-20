// Edit Save API Route — saves edited images to Firebase Storage
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 30;

interface SaveEditRequest {
    imageData: string;        // Base64 image data
    mimeType: string;         // e.g. 'image/png'
    originalImageId: string;  // ID of the original image
    saveAsNew: boolean;       // Create new image doc or overwrite
    prompt: string;           // Original prompt
    promptSetID?: string;     // Group ID
    settings: any;            // Original settings
    collectionIds?: string[]; // Collections
    title?: string;           // Optional title
}

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        let userId: string;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: SaveEditRequest = await request.json();
        const { imageData, mimeType, originalImageId, saveAsNew, prompt, promptSetID, settings, collectionIds, title } = body;

        if (!imageData || !originalImageId) {
            return NextResponse.json({ error: 'Image data and original image ID are required' }, { status: 400 });
        }

        // Verify original image belongs to user
        const originalRef = adminDb.collection('users').doc(userId).collection('images').doc(originalImageId);
        const originalDoc = await originalRef.get();

        if (!originalDoc.exists) {
            return NextResponse.json({ error: 'Original image not found' }, { status: 404 });
        }

        // Upload edited image to Storage
        const bucket = adminStorage.bucket();
        const filename = `users/${userId}/images/${Date.now()}-edited-${Math.random().toString(36).substring(7)}.png`;
        const file = bucket.file(filename);
        const imageBuffer = Buffer.from(imageData, 'base64');

        await file.save(imageBuffer, {
            metadata: {
                contentType: mimeType || 'image/png',
            },
        });

        await file.makePublic();
        const newImageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        if (saveAsNew) {
            // Create a new image document
            const newImageData = {
                userId,
                prompt: `[Edited] ${prompt}`,
                title: title || originalDoc.data()?.title || null,
                settings: {
                    ...settings,
                    editedFrom: originalImageId,
                },
                imageUrl: newImageUrl,
                storagePath: filename,
                creditsCost: 0, // Editing is free
                createdAt: Timestamp.now(),
                downloadCount: 0,
                ...(promptSetID && { promptSetID }),
                ...(collectionIds && collectionIds.length > 0 && { collectionIds }),
            };

            const newDoc = await adminDb.collection('users').doc(userId).collection('images').add(newImageData);

            return NextResponse.json({
                success: true,
                imageId: newDoc.id,
                imageUrl: newImageUrl,
                message: 'Saved as new image',
            });
        } else {
            // Overwrite the original image
            await originalRef.update({
                imageUrl: newImageUrl,
                storagePath: filename,
                updatedAt: Timestamp.now(),
            });

            return NextResponse.json({
                success: true,
                imageId: originalImageId,
                imageUrl: newImageUrl,
                message: 'Image updated',
            });
        }
    } catch (error: any) {
        console.error('[Edit Save] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
