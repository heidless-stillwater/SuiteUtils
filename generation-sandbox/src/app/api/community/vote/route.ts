// Community Vote API Route
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

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
        const { entryId } = body;

        if (!entryId) {
            return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
        }

        const entryRef = adminDb.collection('leagueEntries').doc(entryId);
        const entryDoc = await entryRef.get();

        if (!entryDoc.exists) {
            return NextResponse.json({ error: 'Community entry not found' }, { status: 404 });
        }

        const entryData = entryDoc.data()!;
        const hasVoted = entryData.votes?.[userId] === true;
        const creatorId = entryData.originalUserId;

        if (hasVoted) {
            // Remove vote
            const batch = adminDb.batch();

            // 1. Update the entry
            batch.update(entryRef, {
                [`votes.${userId}`]: FieldValue.delete(),
                voteCount: FieldValue.increment(-1),
            });

            // 1b. Delete timestamped vote record
            const voteRef = adminDb.collection('votes').doc(`${entryId}_${userId}`);
            batch.delete(voteRef);

            // 2. Update creator's total influence
            if (creatorId) {
                const creatorRef = adminDb.collection('users').doc(creatorId);
                batch.set(creatorRef, { totalInfluence: FieldValue.increment(-1) }, { merge: true });
            }

            await batch.commit();

            return NextResponse.json({
                success: true,
                voted: false,
                message: 'Vote removed',
            });
        } else {
            // Add vote
            const batch = adminDb.batch();

            // 1. Update the entry
            batch.update(entryRef, {
                [`votes.${userId}`]: true,
                voteCount: FieldValue.increment(1),
            });

            // 1b. Create timestamped vote record
            const voteRef = adminDb.collection('votes').doc(`${entryId}_${userId}`);
            batch.set(voteRef, {
                entryId,
                userId,
                authorId: creatorId,
                createdAt: Timestamp.now()
            });

            // 2. Update creator's total influence
            if (creatorId) {
                const creatorRef = adminDb.collection('users').doc(creatorId);
                batch.set(creatorRef, { totalInfluence: FieldValue.increment(1) }, { merge: true });

                // 3. Send Notification to creator (if not voting for yourself)
                if (creatorId !== userId) {
                    // Get actor name for notification
                    const actorDoc = await adminDb.collection('users').doc(userId).get();
                    const actorData = actorDoc.data();

                    const notifRef = creatorRef.collection('notifications').doc();
                    batch.set(notifRef, {
                        userId: creatorId,
                        type: 'vote',
                        actorId: userId,
                        actorName: actorData?.displayName || 'Anonymous',
                        actorPhotoURL: actorData?.photoURL || null,
                        entryId: entryId,
                        entryImageUrl: entryData.imageUrl,
                        read: false,
                        createdAt: Timestamp.now()
                    });
                }
            }

            await batch.commit();

            return NextResponse.json({
                success: true,
                voted: true,
                message: 'Vote added!',
            });
        }

    } catch (error: any) {
        console.error('[Community Vote] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
