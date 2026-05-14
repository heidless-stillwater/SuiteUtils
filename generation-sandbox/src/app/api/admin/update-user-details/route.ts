// Admin Update User Details API
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ADMIN_EMAILS } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication (Admin only)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Double check admin status via email or custom claim
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        if (!userData || (userData.role !== 'admin' && userData.role !== 'su' && !ADMIN_EMAILS.includes(decodedToken.email || ''))) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { userId, role, creditsChange } = body;

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const updates: any = {};
        const messages: string[] = [];

        // 1. Handle Role Update
        if (role) {
            if (!['member', 'admin', 'su'].includes(role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
            }
            // Prevent changing own role if not su? Or generic safety?
            // For now allow, but frontend should block critical mistakes.
            await adminDb.collection('users').doc(userId).update({
                role,
                updatedAt: Timestamp.now()
            });
            messages.push(`Role updated to ${role}`);
        }

        // 2. Handle Credits Adjustment
        if (creditsChange !== undefined && typeof creditsChange === 'number' && creditsChange !== 0) {
            const creditsRef = adminDb.collection('users').doc(userId).collection('data').doc('credits');

            await adminDb.runTransaction(async (t: any) => {
                const doc = await t.get(creditsRef);
                if (!doc.exists) {
                    // Create if doesn't exist (unlikely for active users but possible)
                    t.set(creditsRef, {
                        balance: creditsChange > 0 ? creditsChange : 0,
                        totalPurchased: creditsChange > 0 ? creditsChange : 0,
                        totalUsed: 0,
                        createdAt: Timestamp.now()
                    });
                } else {
                    const currentBalance = doc.data()?.balance || 0;
                    const newBalance = Math.max(0, currentBalance + creditsChange);

                    t.update(creditsRef, {
                        balance: newBalance,
                        updatedAt: Timestamp.now()
                    });
                }

                // Log transaction
                const transactionRef = adminDb.collection('users').doc(userId).collection('transactions').doc();
                t.set(transactionRef, {
                    type: creditsChange > 0 ? 'admin_adjustment' : 'admin_deduction',
                    amount: creditsChange,
                    description: 'Admin adjustment',
                    adminId: decodedToken.uid,
                    createdAt: Timestamp.now()
                });
            });
            messages.push(`Credits ${creditsChange > 0 ? 'added' : 'deducted'}: ${Math.abs(creditsChange)}`);
        }

        return NextResponse.json({
            success: true,
            message: messages.join('. ') || 'No changes made'
        });

    } catch (error: any) {
        console.error('Update user details error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
