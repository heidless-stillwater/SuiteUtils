export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const decoded = await adminAuth.verifyIdToken(token);

        // Verify admin role
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!userDoc.exists || !['admin', 'su'].includes(userDoc.data()?.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all users
        const usersSnap = await adminDb.collection('users').get();
        const totalUsers = usersSnap.size;
        const proUsers = usersSnap.docs.filter((d: any) => d.data().subscription === 'pro').length;

        // Platform-wide counts
        const imagesSnap = await adminDb.collectionGroup('images').count().get();
        const totalImages = imagesSnap.data().count;

        const communitySnap = await adminDb.collection('leagueEntries').get();
        const totalPublished = communitySnap.size;

        let totalVotes = 0;
        let totalComments = 0;
        const tagsMap: Record<string, number> = {};

        communitySnap.docs.forEach((doc: any) => {
            const data = doc.data();
            totalVotes += data.voteCount || 0;
            totalComments += data.commentCount || 0;
            if (data.tags && Array.isArray(data.tags)) {
                data.tags.forEach((tag: string) => {
                    tagsMap[tag] = (tagsMap[tag] || 0) + 1;
                });
            }
        });

        const topTags = Object.entries(tagsMap)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Recent activity (last 24h)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        let recentGenerations = 0;
        try {
            const recentImagesSnap = await adminDb.collectionGroup('images')
                .where('createdAt', '>=', oneDayAgo)
                .count()
                .get();
            recentGenerations = recentImagesSnap.data().count;
        } catch (e) {
            console.warn('[Stats] Missing Index for recentGenerations collectionGroup query. Defaulting to 0.');
        }

        // Aggregate credits 
        let totalCreditsHeld = 0;
        let totalLifetimeUsed = 0;

        // Fetch credits in chunks if possible, or just skip if too many to prevent timeout
        // For now, we'll keep the loop but add stricter error handling and concurrency limits
        const creditsPromises = usersSnap.docs.slice(0, 100).map(async (userDoc: any) => {
            try {
                const creditDoc = await adminDb.collection('users').doc(userDoc.id).collection('data').doc('credits').get();
                if (creditDoc.exists) {
                    const data = creditDoc.data()!;
                    return {
                        held: (data.balance || 0) + Math.max(0, (data.dailyAllowance || 0) - (data.dailyAllowanceUsed || 0)),
                        used: (data.totalUsed || 0)
                    };
                }
            } catch (e) {
                return null;
            }
            return null;
        });

        const creditsResults = await Promise.all(creditsPromises);
        creditsResults.forEach(res => {
            if (res) {
                totalCreditsHeld += res.held;
                totalLifetimeUsed += res.used;
            }
        });

        return NextResponse.json({
            totalUsers,
            proUsers,
            totalImages,
            totalCreditsHeld,
            totalLifetimeUsed,
            totalVotes,
            totalComments,
            totalPublished,
            topTags,
            recentGenerations
        });
    } catch (error: any) {
        console.error('Admin stats error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
