// Community Content Reporting API
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
        const { entryId, reason } = body;

        if (!entryId) {
            return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
        }

        const entryRef = adminDb.collection('leagueEntries').doc(entryId);
        const entryDoc = await entryRef.get();

        if (!entryDoc.exists) {
            return NextResponse.json({ error: 'Community entry not found' }, { status: 404 });
        }

        // Check if user already reported this
        const reportRef = entryRef.collection('reports').doc(userId);
        const reportDoc = await reportRef.get();

        if (reportDoc.exists) {
            return NextResponse.json({
                success: true,
                message: 'You have already reported this content. Our moderators are reviewing it.'
            });
        }

        const batch = adminDb.batch();

        // 1. Create report record
        batch.set(reportRef, {
            userId,
            reason: reason || 'Inappropriate content',
            createdAt: Timestamp.now()
        });

        // 2. Increment report count on the entry
        batch.update(entryRef, {
            reportCount: FieldValue.increment(1),
            isModerated: false // Reset or ensure it's in the queue
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: 'Thank you for your report. We will review this content shortly.',
        });

    } catch (error: any) {
        console.error('[Community Report] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
