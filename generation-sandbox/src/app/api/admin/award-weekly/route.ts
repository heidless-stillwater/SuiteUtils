export const dynamic = 'force-dynamic';
// Admin Award Weekly Rewards API Route
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';


export async function POST(request: NextRequest) {
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
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        // 1. Calculate weekly scores (last 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Get reward settings
        const settingsDoc = await adminDb.collection('settings').doc('rewards').get();
        const rewardAmounts = settingsDoc.exists ? settingsDoc.data()?.amounts : [500, 250, 100];

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

        if (sortedAuthors.length === 0) {
            return NextResponse.json({ success: true, message: 'No activity this week to award.' });
        }

        const batch = adminDb.batch();
        const results = [];

        for (let i = 0; i < sortedAuthors.length; i++) {
            const [authorId, score] = sortedAuthors[i];
            const rewardAmount = rewardAmounts[i];

            const userRef = adminDb.collection('users').doc(authorId);
            const creditsRef = userRef.collection('data').doc('credits');
            const historyRef = userRef.collection('creditHistory').doc();

            // Increment balance
            batch.update(creditsRef, {
                balance: FieldValue.increment(rewardAmount)
            });

            // Add transaction record
            batch.set(historyRef, {
                type: 'refund', // Using refund as a generic credit addition type
                amount: rewardAmount,
                description: `Weekly Leaderboard Reward: ${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'} Place`,
                metadata: {
                    rank: i + 1,
                    weeklyScore: score,
                    awardedAt: Timestamp.now()
                },
                createdAt: Timestamp.now()
            });

            // Notification
            const notifRef = userRef.collection('notifications').doc();
            batch.set(notifRef, {
                userId: authorId,
                type: 'system',
                actorId: 'system',
                actorName: 'AI Image Studio',
                text: `Congratulations! You placed ${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'} in the Weekly Leaderboard and won ${rewardAmount} credits!`,
                read: false,
                createdAt: Timestamp.now()
            });

            results.push({ authorId, rank: i + 1, reward: rewardAmount });
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            results,
            message: `Awarded ${sortedAuthors.length} creators.`
        });

    } catch (error: any) {
        console.error('[Award Weekly API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
