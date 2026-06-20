// Community React API Route
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

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
        const { entryId, emoji } = body;

        if (!entryId || !emoji) {
            return NextResponse.json({ error: 'Missing entryId or emoji' }, { status: 400 });
        }

        const entryRef = adminDb.collection('leagueEntries').doc(entryId);
        const entryDoc = await entryRef.get();

        if (!entryDoc.exists) {
            return NextResponse.json({ error: 'Community entry not found' }, { status: 404 });
        }

        const entryData = entryDoc.data()!;
        const reactions = entryData.reactions || {};
        const reactionUsers = reactions[emoji] || [];
        const hasReacted = reactionUsers.includes(userId);

        if (hasReacted) {
            // Remove reaction
            await entryRef.update({
                [`reactions.${emoji}`]: FieldValue.arrayRemove(userId)
            });

            return NextResponse.json({
                success: true,
                reacted: false,
                message: 'Reaction removed',
            });
        } else {
            // Add reaction
            await entryRef.update({
                [`reactions.${emoji}`]: FieldValue.arrayUnion(userId)
            });

            // Optional: Send Notification to creator? 
            // For now, let's keep it quiet to avoid notification spam, 
            // but we could add it later if the user wants.

            return NextResponse.json({
                success: true,
                reacted: true,
                message: 'Reaction added!',
            });
        }

    } catch (error: any) {
        console.error('[Community React] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
