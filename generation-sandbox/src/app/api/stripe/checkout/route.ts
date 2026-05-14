import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminAuth } from '@/lib/firebase-admin';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@/lib/types';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
    try {
        // 1. Verify Authentication
        const authHeader = req.headers.get('Authorization');
        let userId: string | null = null;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        }

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Request
        const { planId } = await req.json();

        if (!planId || !SUBSCRIPTION_PLANS[planId as SubscriptionTier]) {
            return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
        }

        const plan = SUBSCRIPTION_PLANS[planId as SubscriptionTier];
        const priceId = plan.stripePriceId;

        if (!priceId) {
            return NextResponse.json({ error: 'Stripe Price ID not configured for this plan' }, { status: 500 });
        }

        // 3. Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
            client_reference_id: userId, // CRITICAL: Link Stripe to Firebase UID
            metadata: {
                userId: userId,
                planId: planId,
            },
            subscription_data: {
                metadata: {
                    userId: userId,
                    planId: planId,
                }
            }
        });

        return NextResponse.json({ url: session.url });

    } catch (err: any) {
        console.error('[Stripe Checkout] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// Cache break: Tue May  5 16:57:14 BST 2026
