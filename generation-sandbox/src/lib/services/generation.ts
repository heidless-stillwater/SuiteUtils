import { adminDb, adminStorage } from '../firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { CREDIT_COSTS, ImageQuality, AspectRatio, GeneratedImage, MadLibsSelection, SUBSCRIPTION_PLANS, MediaModality, ADMIN_EMAILS } from '../types';

export interface GenerationValidationResult {
    userId: string;
    subscription: string;
    credits: {
        balance: number;
        dailyAllowance: number;
        dailyAllowanceUsed: number;
        lastDailyReset: Timestamp;
    };
    costs: {
        single: number;
        total: number;
    };
    isNewDay: boolean;
    remainingDaily: number;
}

export interface MediaSaveOptions {
    prompt: string;
    quality: ImageQuality;
    aspectRatio: AspectRatio;
    promptType: 'freeform' | 'madlibs';
    madlibsData?: MadLibsSelection;
    seed?: number;
    negativePrompt?: string;
    guidanceScale?: number;
    sourceImageId?: string;
    promptSetID?: string;
    collectionIds?: string[];
    requestedModality: MediaModality;
    modality: MediaModality;
    initialImageUrl?: string;
    targetVariationId?: string;
    title?: string;
    rawPrompt?: string;
    variables?: Record<string, { value: string; default: string }>;
    template?: string;
}

export class GenerationService {
    /**
     * Validates user subscription tiers and constraints.
     */
    static async validateTier(userId: string, body: any) {
        const { modality = 'image', quality, count = 1, seed, negativePrompt, guidanceScale } = body;
        
        // SOVEREIGN_SENTINEL: Real-time Compliance Gating
        const { ComplianceService } = await import('./compliance-service');
        const gate = await ComplianceService.verifySovereignGate();
        if (gate.gated) {
            console.error(`[GenerationService] ACCESS_GATED: ${gate.message}`);
            throw new Error(gate.message);
        }

        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) throw new Error('User not found');

        const userProfile = userDoc.data()!;
        const isAdmin = userProfile.role === 'admin' ||
            userProfile.role === 'su' ||
            ADMIN_EMAILS.includes(userProfile.email || '');
        const isPro = userProfile.subscription === 'pro' || isAdmin;
        const plan = SUBSCRIPTION_PLANS[userProfile.subscription as keyof typeof SUBSCRIPTION_PLANS];

        // 1. Check Quality
        if (modality === 'image' && quality && !isAdmin && !plan.allowedQualities.includes(quality)) {
            throw new Error(`${quality} quality requires ${quality === 'ultra' ? 'Pro' : 'Standard'} subscription`);
        }

        // 2. Check Modality (Video)
        if (modality === 'video' && !isPro) {
            throw new Error('Video generation is a Pro-only feature');
        }

        // 3. Check Batching
        if (count > 1 && !isPro) {
            throw new Error('Batch generation is a Pro-only feature');
        }

        // 4. Check Advanced Controls
        const isUsingAdvanced = seed !== undefined ||
            (negativePrompt !== undefined && negativePrompt.trim() !== '') ||
            (guidanceScale !== undefined && guidanceScale !== 7.0);

        if (isUsingAdvanced && !isPro) {
            throw new Error('Advanced precision controls are Pro-only features');
        }

        return { userProfile, plan };
    }

    /**
     * Checks if user has enough credits and calculates costs.
     */
    static async validateCredits(userId: string, modality: MediaModality, quality: ImageQuality | 'video', count: number): Promise<GenerationValidationResult> {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userProfile = userDoc.data();
        const isSuperUser = userProfile?.role === 'su' || 
                           userProfile?.role === 'admin' || 
                           ADMIN_EMAILS.includes(userProfile?.email || '');

        const creditsRef = adminDb.collection('users').doc(userId).collection('data').doc('credits');
        const creditsDoc = await creditsRef.get();

        if (!creditsDoc.exists && !isSuperUser) throw new Error('Credits not found');

        const credits = creditsDoc.exists ? creditsDoc.data() as any : { balance: 1000, dailyAllowance: 1000, dailyAllowanceUsed: 0, lastDailyReset: Timestamp.now() };
        const singleCost = modality === 'video' ? CREDIT_COSTS.video : CREDIT_COSTS[quality as ImageQuality];
        const totalCost = singleCost * count;

        const lastReset = (credits.lastDailyReset as Timestamp).toDate();
        const today = new Date();
        const isNewDay = lastReset.toDateString() !== today.toDateString();

        const currentDailyUsed = isNewDay ? 0 : credits.dailyAllowanceUsed;
        const remainingDaily = Math.max(0, (credits.dailyAllowance || 0) - currentDailyUsed);
        const totalAvailable = (credits.balance || 0) + remainingDaily;

        if (!isSuperUser && totalAvailable < totalCost) {
            throw new Error(`Insufficient credits. Need ${totalCost}, have ${totalAvailable}`);
        }

        return {
            userId,
            subscription: userProfile?.subscription || 'free',
            credits: { ...credits, isSuperUser } as any,
            costs: { single: isSuperUser ? 0 : singleCost, total: isSuperUser ? 0 : totalCost },
            isNewDay,
            remainingDaily
        };
    }

    /**
     * Deducts credits and logs history.
     */
    static async deductCredits(val: GenerationValidationResult, actualCount: number, options: any) {
        const { userId, isNewDay, remainingDaily, costs, credits } = val;
        const isSuperUser = (credits as any).isSuperUser;
        
        if (isSuperUser) {
            console.log(`[GenerationService] Skipping credit deduction for Super-User: ${userId}`);
            return (credits.balance || 0) + Math.max(0, (credits.dailyAllowance || 0) - (credits.dailyAllowanceUsed || 0));
        }

        const actualTotalCost = costs.single * actualCount;

        const dailyDeduction = Math.min(actualTotalCost, remainingDaily);
        const balanceDeduction = actualTotalCost - dailyDeduction;

        const creditsRef = adminDb.collection('users').doc(userId).collection('data').doc('credits');

        await creditsRef.update({
            balance: (FieldValue as any).increment(-balanceDeduction),
            dailyAllowanceUsed: isNewDay ? dailyDeduction : (FieldValue as any).increment(dailyDeduction),
            lastDailyReset: isNewDay ? Timestamp.now() : (val.credits as any).lastDailyReset,
            totalUsed: (FieldValue as any).increment(actualTotalCost),
        });

        // Add credit transaction
        await adminDb.collection('users').doc(userId).collection('creditHistory').add({
            type: 'usage',
            amount: -actualTotalCost,
            description: `${options.modality === 'video' ? 'Video' : 'Image'} Generation(${actualCount} items, ${options.modality === 'video' ? 'video' : options.quality} quality)`,
            metadata: {
                modality: options.modality,
                quality: options.modality === 'video' ? 'video' : options.quality,
                aspectRatio: options.aspectRatio,
                promptType: options.promptType,
                count: actualCount,
                isAdvanced: options.isAdvanced,
                prompt: options.prompt,
                imageUrl: options.firstImageUrl
            },
            createdAt: Timestamp.now(),
        });

        const updatedCredits = (await creditsRef.get()).data()!;
        return updatedCredits.balance + Math.max(0, updatedCredits.dailyAllowance - updatedCredits.dailyAllowanceUsed);
    }

    /**
     * Saves generated media to Storage and Firestore.
     */
    static async saveMedia(userId: string, media: { data: string, mimeType: string }, options: MediaSaveOptions) {
        console.log(`[GenerationService] saveMedia START for user: ${userId}`);
        const bucket = adminStorage.bucket();
        const { modality, quality, aspectRatio, prompt, promptType, madlibsData, seed, negativePrompt, guidanceScale, sourceImageId, promptSetID, collectionIds, requestedModality, initialImageUrl, targetVariationId, title, rawPrompt, variables, template } = options;

        const isVideo = media.mimeType.startsWith('video/');
        const extension = media.mimeType.split('/')[1] || (isVideo ? 'mp4' : 'png');
        const filename = `users/${userId}/images/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

        const file = bucket.file(filename);
        const mediaBuffer = Buffer.from(media.data, 'base64');

        try {
            await file.save(mediaBuffer, {
                metadata: { contentType: media.mimeType },
            });
        } catch (storageError: any) {
            throw storageError;
        }

        await file.makePublic();
        const mediaUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        const actualModality = isVideo ? 'video' : 'image';

        const settings: any = {
            modality: actualModality,
            quality: actualModality === 'video' ? 'video' : quality,
            aspectRatio,
            prompt,
            promptType,
            requestedModality,
            rawTemplate: rawPrompt || prompt
        };

        if (madlibsData) settings.madlibsData = madlibsData;
        if (seed !== undefined) settings.seed = seed;
        if (negativePrompt) settings.negativePrompt = negativePrompt;
        if (guidanceScale !== undefined) settings.guidanceScale = guidanceScale;

        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userProfile = userDoc.data();
        const isSuperUser = userProfile?.role === 'su' || 
                           userProfile?.role === 'admin' || 
                           ADMIN_EMAILS.includes(userProfile?.email || '');

        const mediaData: any = {
            userId,
            prompt: rawPrompt || prompt,
            settings,
            imageUrl: (actualModality === 'video' && initialImageUrl && !initialImageUrl.includes('dicebear')) ? initialImageUrl : mediaUrl,
            storagePath: filename,
            creditsCost: isSuperUser ? 0 : (isVideo ? CREDIT_COSTS.video : CREDIT_COSTS[quality as ImageQuality]),
            createdAt: Timestamp.now(),
            downloadCount: 0,
            isDraft: false,
            ...(actualModality === 'video' && { videoUrl: mediaUrl }),
            ...(sourceImageId && { sourceImageId }),
            ...(promptSetID && { promptSetID }),
            ...(collectionIds && { collectionIds }),
            ...(title && { title }),
            ...(variables && { variables }),
            ...(template && { template }),
        };

        let mediaDoc;
        if (targetVariationId) {
            // DEFINITIVE OVERWRITE: Update existing variation or create it if it's a virtual placeholder
            const variationRef = adminDb.collection('users').doc(userId).collection('images').doc(targetVariationId);
            await variationRef.set({
                ...mediaData,
                updatedAt: Timestamp.now()
            }, { merge: true });
            mediaDoc = { id: targetVariationId };
        } else {
            mediaDoc = await adminDb.collection('users').doc(userId).collection('images').add(mediaData);
        }

        // Increment variation counts if applicable
        if (sourceImageId) {
            try {
                // 1. Check if it's a league entry ID
                const leagueRef = adminDb.collection('leagueEntries').doc(sourceImageId);
                const leagueSnap = await leagueRef.get();

                if (leagueSnap.exists) {
                    const data = leagueSnap.data();
                    const currentCount = typeof data?.variationCount === 'number' ? data.variationCount : 0;
                    await leagueRef.update({ variationCount: currentCount + 1 });

                    // Also update physical image in original creator's collection
                    if (data?.originalUserId && data?.originalImageId) {
                        const imgRef = adminDb.collection('users').doc(data.originalUserId).collection('images').doc(data.originalImageId);
                        const imgSnap = await imgRef.get();
                        if (imgSnap.exists) {
                            const imgData = imgSnap.data();
                            const oc = typeof imgData?.variationCount === 'number' ? imgData.variationCount : 0;
                            await imgRef.update({ variationCount: oc + 1 });
                        }
                    }
                } else {
                    // 2. Check if it's a user's local image ID
                    const userImgRef = adminDb.collection('users').doc(userId).collection('images').doc(sourceImageId);
                    const userImgSnap = await userImgRef.get();

                    if (userImgSnap.exists) {
                        const data = userImgSnap.data();
                        const currentCount = typeof data?.variationCount === 'number' ? data.variationCount : 0;
                        await userImgRef.update({ variationCount: currentCount + 1 });

                        const q = await adminDb.collection('leagueEntries').where('originalImageId', '==', sourceImageId).limit(1).get();
                        if (!q.empty) {
                            const le = q.docs[0];
                            const leData = le.data();
                            const lc = typeof leData?.variationCount === 'number' ? leData.variationCount : 0;
                            await le.ref.update({ variationCount: lc + 1 });
                        }
                    }
                }
            } catch (err) {
                console.warn('Failed to increment variation count:', err);
            }
        }

        return { ...mediaData, id: mediaDoc.id };
    }
}
