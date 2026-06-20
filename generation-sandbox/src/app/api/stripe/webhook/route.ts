import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@/lib/types';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event;

    try {
        if (!sig || !endpointSecret) {
            console.error('[Stripe Webhook] Missing signature or secret');
            return NextResponse.json({ error: 'Webhook Secret not configured' }, { status: 400 });
        }
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`[Stripe Webhook] Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as any;
                const userId = session.client_reference_id;
                const planId = session.metadata?.planId as SubscriptionTier;

                if (!userId || !planId) {
                    console.error('[Stripe Webhook] Missing userId or planId in session', { userId, planId });
                    break;
                }

                console.log(`[Stripe Webhook] Processing successful checkout for user: ${userId}, plan: ${planId}`);

                const plan = SUBSCRIPTION_PLANS[planId];

                // 1. Update User Profile
                await adminDb.collection('users').doc(userId).update({
                    subscription: planId,
                    updatedAt: Timestamp.now(),
                });

                // 2. Grant Bonus Credits
                const creditsRef = adminDb.collection('users').doc(userId).collection('data').doc('credits');
                const bonusAmount = plan.creditsPerMonth;

                await creditsRef.update({
                    balance: FieldValue.increment(bonusAmount),
                    totalPurchased: FieldValue.increment(bonusAmount),
                    dailyAllowance: plan.dailyAllowance, // Update daily limit too
                });

                // 3. Record Transaction
                await adminDb.collection('users').doc(userId).collection('creditHistory').add({
                    type: 'subscription',
                    amount: bonusAmount,
                    description: `Subscription Upgrade: ${plan.name}`,
                    metadata: {
                        stripeSessionId: session.id,
                        planId: planId,
                    },
                    createdAt: Timestamp.now(),
                });

                break;

            case 'customer.subscription.deleted':
                // Handle cancellation (revert to free tier)
                const subscription = event.data.object as any;
                const subUserId = subscription.metadata?.userId;

                if (subUserId) {
                    await adminDb.collection('users').doc(subUserId).update({
                        subscription: 'free',
                        updatedAt: Timestamp.now(),
                    });

                    // Reset daily allowance to free tier
                    const subCreditsRef = adminDb.collection('users').doc(subUserId).collection('data').doc('credits');
                    await subCreditsRef.update({
                        dailyAllowance: SUBSCRIPTION_PLANS.free.dailyAllowance,
                    });
                }
                break;

            default:
                console.log(`[Stripe Webhook] Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (err: any) {
        console.error('[Stripe Webhook] Processing Error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

// Ensure the raw body is preserved for Stripe signature verification
// Ensure the raw body is preserved for Stripe signature verification
// In App Router, we consume the body as text/buffer manually, so we don't need bodyParser: false config.
export const dynamic = 'force-dynamic';
