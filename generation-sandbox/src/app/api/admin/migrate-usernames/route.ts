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

        console.log('🚀 Starting Username Migration via API...');

        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.where('username', '==', null).get(); // Technically might not be 'null', maybe undefined
        const allUsers = await usersRef.get();
        const usersToMigrate = allUsers.docs.filter((doc: any) => !doc.data().username);

        console.log(`📊 Found ${usersToMigrate.length} users without usernames.`);

        const batchSize = 500;
        let processed = 0;

        for (let i = 0; i < usersToMigrate.length; i += batchSize) {
            const batch = adminDb.batch();
            const chunk = usersToMigrate.slice(i, i + batchSize);

            chunk.forEach((doc: any) => {
                const data = doc.data();
                const displayName = data.displayName || 'user';
                const base = displayName.toLowerCase().replace(/\s+/g, '_');
                const username = `${base}_${doc.id.substring(0, 5)}`;

                batch.update(doc.ref, {
                    username: username,
                    updatedAt: new Date()
                });
            });

            await batch.commit();
            processed += chunk.length;
            console.log(`✅ Processed ${processed}/${usersToMigrate.length} users...`);
        }

        return NextResponse.json({
            success: true,
            processedUsers: processed,
            message: 'Username migration complete'
        });

    } catch (error: any) {
        console.error('[Username Migration API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
