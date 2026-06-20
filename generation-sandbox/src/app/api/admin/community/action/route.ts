// Admin Moderation Actions API
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication (Admin/SU only)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin' && userData?.role !== 'su') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { entryId, action } = body; // action: 'dismiss' | 'remove'

        if (!entryId || !action) {
            return NextResponse.json({ error: 'Missing entryId or action' }, { status: 400 });
        }

        const entryRef = adminDb.collection('leagueEntries').doc(entryId);
        const entryDoc = await entryRef.get();

        if (!entryDoc.exists) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        const entryData = entryDoc.data()!;
        const batch = adminDb.batch();

        if (action === 'dismiss') {
            // Clear report count and mark as moderated
            batch.update(entryRef, {
                reportCount: 0,
                isModerated: true
            });

            // Delete all report details
            const reportsSnapshot = await entryRef.collection('reports').get();
            reportsSnapshot.docs.forEach((doc: any) => {
                batch.delete(doc.ref);
            });

        } else if (action === 'remove') {
            // 1. Unpublish from community hub
            const imageRef = adminDb.collection('users').doc(entryData.originalUserId).collection('images').doc(entryData.originalImageId);
            batch.update(imageRef, {
                publishedToCommunity: false,
                communityEntryId: FieldValue.delete(),
                // Keep old fields for safety during transition
                publishedToLeague: false,
                leagueEntryId: FieldValue.delete()
            });

            // 2. Adjust author influence (remove votes from this entry)
            const authorRef = adminDb.collection('users').doc(entryData.originalUserId);
            const votesToRemove = entryData.voteCount || 0;

            if (votesToRemove > 0) {
                batch.update(authorRef, {
                    totalInfluence: FieldValue.increment(-votesToRemove)
                });
            }

            // 3. Delete the league entry
            batch.delete(entryRef);

            // Note: We don't delete comments here to keep history, but they'll be orphaned.
            // In a real app, we might want to archive the entry instead of hard delete.
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: action === 'remove' ? 'Content removed from league' : 'Reports dismissed'
        });

    } catch (error: any) {
        console.error('[Admin Moderate] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
