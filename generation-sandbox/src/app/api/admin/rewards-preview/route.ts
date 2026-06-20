// Admin Rewards Preview API Route
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
    try {
        // Verify authentication (Admin only)
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

        // 1. Calculate weekly scores (last 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const votesSnapshot = await adminDb.collection('votes')
            .where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
            .get();

        const authorStats: Record<string, number> = {};
        votesSnapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            if (data.authorId) {
                authorStats[data.authorId] = (authorStats[data.authorId] || 0) + 1;
            }
        });

        // 2. Sort and get top 3
        const sortedAuthors = Object.entries(authorStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        const previewData = [];
        for (const [authorId, score] of sortedAuthors) {
            const authorDoc = await adminDb.collection('users').doc(authorId).get();
            const authorData = authorDoc.data();
            previewData.push({
                uid: authorId,
                username: authorData?.username || 'unknown',
                displayName: authorData?.displayName || 'Unknown User',
                photoURL: authorData?.photoURL || null,
                score: score,
                publishedCount: authorData?.publishedCount || 0
            });
        }

        // 3. Get current reward settings
        const settingsDoc = await adminDb.collection('settings').doc('rewards').get();
        const rewards = settingsDoc.exists ? settingsDoc.data()?.amounts : [500, 250, 100];

        // 4. Calculate total unique published creators
        const entriesSnapshot = await adminDb.collection('leagueEntries').get();
        const uniqueAuthors = new Set();
        entriesSnapshot.docs.forEach((doc: any) => {
            const userId = doc.data().originalUserId;
            if (userId) uniqueAuthors.add(userId);
        });

        return NextResponse.json({
            success: true,
            leaders: previewData,
            totalContestants: uniqueAuthors.size,
            currentRewards: rewards
        });

    } catch (error: any) {
        console.error('[Rewards Preview API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
