// Admin Update Settings API Route
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
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { type, settings } = body;

        if (type === 'rewards') {
            const { amounts } = settings;
            if (!Array.isArray(amounts) || amounts.length !== 3) {
                return NextResponse.json({ error: 'Rewards must be an array of 3 numbers' }, { status: 400 });
            }
            await adminDb.collection('settings').doc('rewards').set({
                amounts,
                updatedAt: new Date(),
                updatedBy: decodedToken.uid
            });
        } else {
            return NextResponse.json({ error: 'Invalid settings type' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Settings updated successfully'
        });

    } catch (error: any) {
        console.error('[Update Settings API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
