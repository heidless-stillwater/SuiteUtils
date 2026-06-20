// User Follow API Route
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { UserService } from '@/lib/services/user';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        let currentUserId: string;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decodedToken = await adminAuth.verifyIdToken(token);
            currentUserId = decodedToken.uid;
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { targetUserId, action } = body; // action: 'follow' | 'unfollow'

        if (!targetUserId || !action) {
            return NextResponse.json({ error: 'Missing targetUserId or action' }, { status: 400 });
        }

        if (action === 'follow') {
            const result = await UserService.followUser({ currentUserId, targetUserId });
            return NextResponse.json({
                success: true,
                ...result
            });
        } else if (action === 'unfollow') {
            const result = await UserService.unfollowUser({ currentUserId, targetUserId });
            return NextResponse.json({
                success: true,
                ...result
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('[User Follow] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
