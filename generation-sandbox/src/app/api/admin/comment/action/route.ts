// Admin Comment Moderation Action API Route
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ADMIN_EMAILS } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication (Admin only)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Double check admin status via email or custom claim
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        if (!userData || (userData.role !== 'admin' && userData.role !== 'su' && !ADMIN_EMAILS.includes(decodedToken.email || ''))) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { entryId, commentId, action } = body;

        if (!entryId || !commentId || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const commentRef = adminDb.collection('leagueEntries').doc(entryId).collection('comments').doc(commentId);
        const entryRef = adminDb.collection('leagueEntries').doc(entryId);

        const commentDoc = await commentRef.get();
        if (!commentDoc.exists) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        // Perform action
        if (action === 'dismiss') {
            // Clear report count
            await commentRef.update({
                reportCount: 0
            });
            return NextResponse.json({ success: true, message: 'Reports dismissed' });
        } else if (action === 'delete') {
            // Delete comment and decrement comment count on entry
            await adminDb.runTransaction(async (t: any) => {
                t.delete(commentRef);
                t.update(entryRef, {
                    commentCount: FieldValue.increment(-1)
                });
            });
            return NextResponse.json({ success: true, message: 'Comment deleted' });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Comment action error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
