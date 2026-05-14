import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        await adminAuth.verifyIdToken(token);

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.toLowerCase() || '';

        if (query.length < 1) {
            return NextResponse.json({ users: [] });
        }

        // Search users by username prefix
        // Firestore prefix search: query >= query and query < query + \uf8ff
        const snapshot = await adminDb.collection('users')
            .where('username', '>=', query)
            .where('username', '<=', query + '\uf8ff')
            .orderBy('username')
            .limit(5)
            .get();

        const users = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                uid: doc.id,
                username: data.username,
                displayName: data.displayName,
                photoURL: data.photoURL
            };
        });

        return NextResponse.json({ users });

    } catch (error: any) {
        console.error('[User Search API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
