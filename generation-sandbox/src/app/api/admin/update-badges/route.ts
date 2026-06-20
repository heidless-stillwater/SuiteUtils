// Admin Update Badges API Route
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const decodedToken = await adminAuth.verifyIdToken(token);
        const adminId = decodedToken.uid;

        // Verify admin role
        const adminDoc = await adminDb.collection('users').doc(adminId).get();
        const adminData = adminDoc.data();
        if (adminData?.role !== 'admin' && adminData?.role !== 'su') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { userId, badges } = body;

        if (!userId || !Array.isArray(badges)) {
            return NextResponse.json({ error: 'Missing userId or badges array' }, { status: 400 });
        }

        // Update user badges
        await adminDb.collection('users').doc(userId).update({
            badges: badges,
            updatedAt: new Date()
        });

        return NextResponse.json({
            success: true,
            message: `Updated badges for user ${userId}`
        });

    } catch (error: any) {
        console.error('[Admin] Badge update error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
