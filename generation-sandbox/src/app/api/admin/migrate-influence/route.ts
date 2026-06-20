export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

        console.log('🚀 Starting Influence Migration via API...');

        const entriesRef = adminDb.collection('leagueEntries');
        const usersRef = adminDb.collection('users');

        const snapshot = await entriesRef.get();
        console.log(`📊 Found ${snapshot.size} league entries.`);

        const influenceMap: Record<string, number> = {};
        const publicationsMap: Record<string, number> = {};

        snapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            const userId = data.originalUserId;
            const votes = data.voteCount || 0;

            if (userId) {
                influenceMap[userId] = (influenceMap[userId] || 0) + votes;
                publicationsMap[userId] = (publicationsMap[userId] || 0) + 1;
            }
        });

        const userIds = Object.keys(publicationsMap);
        console.log(`👥 Updating ${userIds.length} users with publications...`);

        const batchSize = 500;
        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = adminDb.batch();
            const chunk = userIds.slice(i, i + batchSize);

            chunk.forEach(uid => {
                batch.set(usersRef.doc(uid), {
                    totalInfluence: influenceMap[uid] || 0,
                    publishedCount: publicationsMap[uid] || 0
                }, { merge: true });
            });

            await batch.commit();
            console.log(`✅ Processed ${i + chunk.length}/${userIds.length} users...`);
        }

        return NextResponse.json({
            success: true,
            processedUsers: userIds.length,
            message: 'Migration complete'
        });

    } catch (error: any) {
        console.error('[Migration API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
