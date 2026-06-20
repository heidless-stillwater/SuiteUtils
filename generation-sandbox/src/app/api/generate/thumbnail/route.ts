// Thumbnail Upload API Route
// Accepts a base64 JPEG thumbnail extracted from a video's first frame
// and stores it in GCS, then updates the Firestore doc's imageUrl

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';

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
            const sessionCookie = request.cookies.get('session')?.value;
            if (!sessionCookie) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const decodedCookie = await adminAuth.verifySessionCookie(sessionCookie);
            userId = decodedCookie.uid;
        }

        const body = await request.json();
        const { imageId, thumbnailBase64, duration } = body;

        if (!imageId || !thumbnailBase64) {
            return NextResponse.json({ error: 'Missing imageId or thumbnailBase64' }, { status: 400 });
        }

        // Verify the image belongs to this user
        const imageRef = adminDb.collection('users').doc(userId).collection('images').doc(imageId);
        const imageDoc = await imageRef.get();

        if (!imageDoc.exists) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        const imageData = imageDoc.data()!;
        if (imageData.userId !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Upload thumbnail to GCS
        const bucket = adminStorage.bucket();
        const thumbnailFilename = `users/${userId}/thumbnails/${imageId}.jpg`;
        const thumbnailFile = bucket.file(thumbnailFilename);

        // Strip data URL prefix if present
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const thumbnailBuffer = Buffer.from(base64Data, 'base64');

        await thumbnailFile.save(thumbnailBuffer, {
            metadata: {
                contentType: 'image/jpeg',
            },
        });

        await thumbnailFile.makePublic();
        const thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailFilename}`;

        // Update Firestore doc: set imageUrl to thumbnail, keep videoUrl as-is
        await imageRef.update({
            imageUrl: thumbnailUrl,
            thumbnailStoragePath: thumbnailFilename,
            duration: duration || null
        });

        return NextResponse.json({ success: true, thumbnailUrl });

    } catch (error: any) {
        console.error('Thumbnail upload error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
