// Credit Management Service
import { doc, getDoc, setDoc, collection, addDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import {
    UserCredits,
    CreditTransaction,
    TransactionType,
    CREDIT_COSTS,
    ImageQuality,
    SubscriptionTier,
    DAILY_ALLOWANCE
} from '../types';

export class CreditsService {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    // Get current credits
    async getCredits(): Promise<UserCredits | null> {
        const creditsRef = doc(db, 'users', this.userId, 'data', 'credits');
        const snap = await getDoc(creditsRef);
        return snap.exists() ? (snap.data() as UserCredits) : null;
    }

    // Calculate available credits (balance + remaining daily allowance)
    async getAvailableCredits(): Promise<number> {
        const credits = await this.getCredits();
        if (!credits) return 0;

        // Check if daily reset needed
        const lastReset = credits.lastDailyReset.toDate();
        const today = new Date();
        const isNewDay = lastReset.toDateString() !== today.toDateString();

        if (isNewDay) {
            // Reset daily allowance
            await this.resetDailyAllowance();
            return credits.balance + credits.dailyAllowance;
        }

        const remainingDaily = Math.max(0, credits.dailyAllowance - credits.dailyAllowanceUsed);
        return credits.balance + remainingDaily;
    }

    // Reset daily allowance
    async resetDailyAllowance(): Promise<void> {
        const creditsRef = doc(db, 'users', this.userId, 'data', 'credits');
        await setDoc(creditsRef, {
            dailyAllowanceUsed: 0,
            lastDailyReset: Timestamp.now(),
        }, { merge: true });
    }

    // Check if user can afford generation
    async canAfford(quality: ImageQuality): Promise<boolean> {
        const cost = CREDIT_COSTS[quality];
        const available = await this.getAvailableCredits();
        return available >= cost;
    }

    // Deduct credits for image generation
    async deductCredits(
        quality: ImageQuality,
        description: string
    ): Promise<{ success: boolean; newBalance: number; error?: string }> {
        const cost = CREDIT_COSTS[quality];
        const creditsRef = doc(db, 'users', this.userId, 'data', 'credits');

        try {
            return await runTransaction(db, async (transaction) => {
                const creditsDoc = await transaction.get(creditsRef);

                if (!creditsDoc.exists()) {
                    throw new Error('Credits not found');
                }

                const credits = creditsDoc.data() as UserCredits;

                // Check for daily reset
                const lastReset = credits.lastDailyReset.toDate();
                const today = new Date();
                const isNewDay = lastReset.toDateString() !== today.toDateString();

                let currentDailyUsed = isNewDay ? 0 : credits.dailyAllowanceUsed;
                let lastDailyReset = isNewDay ? Timestamp.now() : credits.lastDailyReset;

                const remainingDaily = Math.max(0, credits.dailyAllowance - currentDailyUsed);
                const totalAvailable = credits.balance + remainingDaily;

                if (totalAvailable < cost) {
                    throw new Error(`Insufficient credits. Need ${cost}, have ${totalAvailable}`);
                }

                // Deduct from daily allowance first, then from balance
                let dailyDeduction = Math.min(cost, remainingDaily);
                let balanceDeduction = cost - dailyDeduction;

                const newCredits: UserCredits = {
                    ...credits,
                    balance: credits.balance - balanceDeduction,
                    dailyAllowanceUsed: currentDailyUsed + dailyDeduction,
                    lastDailyReset: lastDailyReset,
                    totalUsed: credits.totalUsed + cost,
                };

                transaction.set(creditsRef, newCredits);

                // Add transaction record
                const txRef = doc(collection(db, 'users', this.userId, 'creditHistory'));
                const txRecord: Omit<CreditTransaction, 'id'> = {
                    type: 'usage',
                    amount: -cost,
                    description,
                    metadata: { quality, dailyDeduction, balanceDeduction },
                    createdAt: Timestamp.now(),
                };
                transaction.set(txRef, { ...txRecord, id: txRef.id });

                return {
                    success: true,
                    newBalance: newCredits.balance + (newCredits.dailyAllowance - newCredits.dailyAllowanceUsed)
                };
            });
        } catch (error: any) {
            return { success: false, newBalance: 0, error: error.message };
        }
    }

    // Add credits (from purchase or subscription)
    async addCredits(
        amount: number,
        type: TransactionType,
        description: string,
        metadata?: Record<string, any>
    ): Promise<{ success: boolean; newBalance: number }> {
        const creditsRef = doc(db, 'users', this.userId, 'data', 'credits');

        return await runTransaction(db, async (transaction) => {
            const creditsDoc = await transaction.get(creditsRef);

            if (!creditsDoc.exists()) {
                throw new Error('Credits not found');
            }

            const credits = creditsDoc.data() as UserCredits;
            const newBalance = credits.balance + amount;

            transaction.update(creditsRef, {
                balance: newBalance,
                totalPurchased: credits.totalPurchased + amount,
            });

            // Add transaction record
            const txRef = doc(collection(db, 'users', this.userId, 'creditHistory'));
            const txRecord: Omit<CreditTransaction, 'id'> = {
                type,
                amount,
                description,
                metadata,
                createdAt: Timestamp.now(),
            };
            transaction.set(txRef, { ...txRecord, id: txRef.id });

            return { success: true, newBalance };
        });
    }

    // Update subscription and daily allowance
    async updateSubscription(newTier: SubscriptionTier): Promise<void> {
        const creditsRef = doc(db, 'users', this.userId, 'data', 'credits');
        await setDoc(creditsRef, {
            dailyAllowance: DAILY_ALLOWANCE[newTier],
        }, { merge: true });
    }
}
