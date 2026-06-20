import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        // 1. Verify Authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // 2. Parse Request
        const { sessionId } = await req.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        console.log(`[Stripe Verify] Verifying session ${sessionId} for user ${userId}`);

        // 3. Retrieve Session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // 4. Security Check: Ensure session belongs to this user
        if (session.client_reference_id !== userId && session.metadata?.userId !== userId) {
            console.error('[Stripe Verify] Session user mismatch', {
                sessionUser: session.client_reference_id || session.metadata?.userId,
                authUserId: userId
            });
            return NextResponse.json({ error: 'Session does not belong to user' }, { status: 403 });
        }

        // 5. Check Session Status
        if (session.status !== 'complete' || session.payment_status !== 'paid') {
            console.log(`[Stripe Verify] Session not paid. Status: ${session.status}, Payment: ${session.payment_status}`);
            return NextResponse.json({
                success: false,
                status: session.status,
                paymentStatus: session.payment_status,
                message: 'Payment not yet confirmed by Stripe'
            });
        }

        // 6. Check if already processed (Idempotency)
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const planId = session.metadata?.planId as SubscriptionTier;

        if (userData?.subscription === planId) {
            return NextResponse.json({
                success: true,
                alreadyProcessed: true,
                message: 'Subscription already active'
            });
        }

        // 7. Update User Profile & Credits (Same logic as webhook)
        console.log(`[Stripe Verify] Processing upgrade for ${userId} to ${planId}`);
        const plan = SUBSCRIPTION_PLANS[planId];

        const batch = adminDb.batch();

        // Update Profile
        batch.update(adminDb.collection('users').doc(userId), {
            subscription: planId,
            updatedAt: Timestamp.now(),
        });

        // Grant Bonus Credits
        const creditsRef = adminDb.collection('users').doc(userId).collection('data').doc('credits');
        const bonusAmount = plan.creditsPerMonth;

        batch.update(creditsRef, {
            balance: FieldValue.increment(bonusAmount),
            totalPurchased: FieldValue.increment(bonusAmount),
            dailyAllowance: plan.dailyAllowance,
        });

        // Record Transaction
        const historyRef = adminDb.collection('users').doc(userId).collection('creditHistory').doc();
        batch.set(historyRef, {
            type: 'subscription',
            amount: bonusAmount,
            description: `Subscription Upgrade (Manual Verify): ${plan.name}`,
            metadata: {
                stripeSessionId: session.id,
                planId: planId,
                verifiedAt: Timestamp.now(),
            },
            createdAt: Timestamp.now(),
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: `Successfully upgraded to ${plan.name}!`,
            plan: planId
        });

    } catch (err: any) {
        console.error('[Stripe Verify] Error:', err);
        return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
    }
}
