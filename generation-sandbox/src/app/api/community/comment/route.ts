// Community Comment API Route
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

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

        const body = await request.json();
        const { entryId, text } = body;

        if (!entryId || !text?.trim()) {
            return NextResponse.json({ error: 'Missing entryId or text' }, { status: 400 });
        }

        // Validate text length
        const trimmedText = text.trim();
        if (trimmedText.length > 500) {
            return NextResponse.json({ error: 'Comment too long (max 500 characters)' }, { status: 400 });
        }

        // Verify entry exists
        const entryRef = adminDb.collection('leagueEntries').doc(entryId);
        const entryDoc = await entryRef.get();

        if (!entryDoc.exists) {
            return NextResponse.json({ error: 'Community entry not found' }, { status: 404 });
        }

        // Get user profile for display info
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userProfile = userDoc.data()!;

        // Create batch for atomic operations
        const batch = adminDb.batch();

        // 1. Create comment
        const commentData = {
            entryId,
            userId,
            userName: userProfile.displayName || 'Anonymous',
            userPhotoURL: userProfile.photoURL || null,
            userBadges: userProfile.badges || [],
            text: trimmedText,
            createdAt: Timestamp.now(),
        };

        const commentRef = entryRef.collection('comments').doc();
        batch.set(commentRef, commentData);

        // 2. Increment comment count
        batch.update(entryRef, {
            commentCount: FieldValue.increment(1),
        });

        // 3. Send Notification to creator (if not commenting on your own work)
        const entryData = entryDoc.data()!;
        const creatorId = entryData.originalUserId;

        if (creatorId && creatorId !== userId) {
            const notifRef = adminDb.collection('users').doc(creatorId).collection('notifications').doc();
            batch.set(notifRef, {
                userId: creatorId,
                type: 'comment',
                actorId: userId,
                actorName: userProfile.displayName || 'Anonymous',
                actorPhotoURL: userProfile.photoURL || null,
                entryId: entryId,
                entryImageUrl: entryData.imageUrl,
                text: trimmedText,
                read: false,
                createdAt: Timestamp.now()
            });
        }

        const mentionRegex = /@([a-z0-9_]{3,20})/g;
        const matches = [...trimmedText.toLowerCase().matchAll(mentionRegex)];
        const uniqueMatches = Array.from(new Set(matches.map(m => m[1])));
        const mentionedUsernames = uniqueMatches;

        if (mentionedUsernames.length > 0) {
            // Find users by username
            const usersRef = adminDb.collection('users');
            const mentionPromises = mentionedUsernames.map(username =>
                usersRef.where('username', '==', username).limit(1).get()
            );

            const mentionSnapshots = await Promise.all(mentionPromises);

            mentionSnapshots.forEach((snap, index) => {
                if (!snap.empty) {
                    const mentionedUserDoc = snap.docs[0];
                    const mentionedUserId = mentionedUserDoc.id;

                    // Don't notify yourself or the creator (already notified above)
                    if (mentionedUserId !== userId && mentionedUserId !== creatorId) {
                        const mentionNotifRef = usersRef.doc(mentionedUserId).collection('notifications').doc();
                        batch.set(mentionNotifRef, {
                            userId: mentionedUserId,
                            type: 'mention',
                            actorId: userId,
                            actorName: userProfile.displayName || 'Anonymous',
                            actorPhotoURL: userProfile.photoURL || null,
                            entryId: entryId,
                            entryImageUrl: entryData.imageUrl,
                            text: trimmedText,
                            read: false,
                            createdAt: Timestamp.now()
                        });
                    }
                }
            });
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            comment: { id: commentRef.id, ...commentData },
            message: 'Comment added!',
        });

    } catch (error: any) {
        console.error('[Community Comment POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const entryId = searchParams.get('entryId');
        const commentId = searchParams.get('commentId');

        if (!entryId || !commentId) {
            return NextResponse.json({ error: 'Missing entryId or commentId' }, { status: 400 });
        }

        const entryRef = adminDb.collection('leagueEntries').doc(entryId);
        const commentRef = entryRef.collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        const commentData = commentDoc.data()!;

        // Check authorization: comment author or admin
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userProfile = userDoc.data()!;
        const isAdminOrSu = userProfile.role === 'admin' || userProfile.role === 'su';

        if (commentData.userId !== userId && !isAdminOrSu) {
            return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 });
        }

        // Delete comment and decrement count
        await commentRef.delete();
        await entryRef.update({
            commentCount: FieldValue.increment(-1),
        });

        return NextResponse.json({
            success: true,
            message: 'Comment deleted.',
        });

    } catch (error: any) {
        console.error('[Community Comment DELETE] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
