
import { adminDb, defaultDb } from '../firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface CommunityPublishOptions {
    userId: string;
    imageId: string;
}

export class CommunityService {
    /**
     * Publishes an image to the community hub.
     */
    static async publishImage({ userId, imageId }: CommunityPublishOptions) {
        console.log(`[CommunityService] Publishing image. userId: ${userId}, imageId: ${imageId}`);
        // Try partitioned database first
        let imageRef = adminDb.collection('users').doc(userId).collection('images').doc(imageId);
        console.log(`[CommunityService] Checking imageRef at path: ${imageRef.path}`);
        let imageDoc = await imageRef.get();

        if (!imageDoc.exists) {
            console.log(`[CommunityService] Image not found in partitioned database. Checking (default)...`);
            imageRef = defaultDb.collection('users').doc(userId).collection('images').doc(imageId);
            imageDoc = await imageRef.get();
        }

        if (!imageDoc.exists) {
            console.error(`[CommunityService] Image not found in either database for userId: ${userId}, imageId: ${imageId}`);
            throw new Error('Image not found');
        }

        const imageData = imageDoc.data()!;

        // Check if already published (check both new and legacy field names)
        const isAlreadyPublished = imageData.publishedToCommunity || imageData.publishedToLeague;
        if (isAlreadyPublished) {
            throw new Error('Image already published to community');
        }

        // Get user profile for author info
        let userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.log(`[CommunityService] User profile not found in partitioned database. Checking (default)...`);
            userDoc = await defaultDb.collection('users').doc(userId).get();
        }

        if (!userDoc.exists) {
            console.error(`[CommunityService] User profile not found in either database for userId: ${userId}`);
            throw new Error('User profile not found');
        }

        const userProfile = userDoc.data()!;

        // Get collection names
        const collectionIds = imageData.collectionIds || (imageData.collectionId ? [imageData.collectionId] : []);
        const collectionNames: string[] = [];
        if (collectionIds.length > 0) {
            // Try partitioned first
            let collectionsSnap = await adminDb.collection('users').doc(userId).collection('collections')
                .where('__name__', 'in', collectionIds.slice(0, 10))
                .get();
            
            if (collectionsSnap.empty) {
                console.log(`[CommunityService] Collections not found in partitioned database. Checking (default)...`);
                collectionsSnap = await defaultDb.collection('users').doc(userId).collection('collections')
                    .where('__name__', 'in', collectionIds.slice(0, 10))
                    .get();
            }

            collectionsSnap.forEach((doc: any) => {
                collectionNames.push(doc.data().name);
            });
        }

        // Create community entry with denormalized data
        const communityEntryData = {
            originalImageId: imageId,
            originalUserId: userId,
            imageUrl: imageData.imageUrl,
            videoUrl: imageData.videoUrl || null,
            duration: imageData.duration || null,
            prompt: imageData.prompt,
            settings: imageData.settings,
            authorName: userProfile.displayName || 'Anonymous',
            authorPhotoURL: userProfile.photoURL || null,
            authorBadges: userProfile.badges || [],
            publishedAt: Timestamp.now(),
            voteCount: 0,
            commentCount: 0,
            shareCount: 0,
            variationCount: 0,
            authorFollowerCount: userProfile.followerCount || 0,
            votes: {},
            collectionIds,
            collectionNames,
            tags: imageData.tags || [],
            promptSetID: imageData.promptSetID || null,
            isExemplar: imageData.isExemplar || false,
            title: imageData.title || null,
        };

        const communityEntryRef = adminDb.collection('leagueEntries').doc();
        const batch = adminDb.batch();

        // 1. Create community entry
        batch.set(communityEntryRef, {
            ...communityEntryData,
            id: communityEntryRef.id
        });

        // 2. Update original image
        const updateData = {
            publishedToCommunity: true,
            communityEntryId: communityEntryRef.id,
        };

        if (imageRef.firestore.databaseId === adminDb.databaseId) {
            batch.update(imageRef, updateData);
        } else {
            await imageRef.update(updateData);
        }

        // 3. Update creator profile
        const creatorRef = adminDb.collection('users').doc(userId);
        const profileUpdate = {
            publishedCount: FieldValue.increment(1)
        };

        if (creatorRef.firestore.databaseId === adminDb.databaseId) {
            batch.set(creatorRef, profileUpdate, { merge: true });
        } else {
            await creatorRef.set(profileUpdate, { merge: true });
        }

        await batch.commit();

        return {
            communityEntryId: communityEntryRef.id,
            message: 'Image published to community!',
        };
    }

    /**
     * Removes an image from the community hub.
     */
    static async unpublishImage({ userId, imageId }: CommunityPublishOptions) {
        console.log(`[CommunityService] Unpublishing image. userId: ${userId}, imageId: ${imageId}`);
        let imageRef = adminDb.collection('users').doc(userId).collection('images').doc(imageId);
        let imageDoc = await imageRef.get();

        if (!imageDoc.exists) {
            console.log(`[CommunityService] Image not found in partitioned database during unpublish. Checking (default)...`);
            imageRef = defaultDb.collection('users').doc(userId).collection('images').doc(imageId);
            imageDoc = await imageRef.get();
        }

        let entryId: string | null = null;

        if (imageDoc.exists) {
            const imageData = imageDoc.data()!;
            entryId = imageData.communityEntryId || imageData.leagueEntryId || null;
            
            const isPublished = imageData.publishedToCommunity || imageData.publishedToLeague;
            if (!isPublished || !entryId) {
                throw new Error('Image is not published to community');
            }
        } else {
            console.warn(`[CommunityService] Image not found in either database during unpublish. Attempting to find leagueEntry by ID...`);
            // Fallback: try to find the entry by querying for the imageId + userId
            const entriesSnap = await adminDb.collection('leagueEntries')
                .where('originalUserId', '==', userId)
                .where('originalImageId', '==', imageId)
                .limit(1)
                .get();
            
            if (!entriesSnap.empty) {
                entryId = entriesSnap.docs[0].id;
                console.log(`[CommunityService] Found orphaned leagueEntry: ${entryId}`);
            } else {
                console.error(`[CommunityService] No leagueEntry found for orphaned imageId: ${imageId}`);
                throw new Error('Image not found and no associated community entry detected.');
            }
        }

        // Delete the community entry — uses entryId resolved above
        const communityEntryRef = adminDb.collection('leagueEntries').doc(entryId);
        const communityEntryDoc = await communityEntryRef.get();

        if (!communityEntryDoc.exists) {
            // If entry is missing but image thinks it is published, just fix the image
            if (imageDoc.exists) {
                await imageRef.update({
                    publishedToCommunity: false,
                    communityEntryId: FieldValue.delete(),
                    publishedToLeague: false,
                    leagueEntryId: FieldValue.delete(),
                });
            }
            return { message: 'Image status cleaned up.' };
        }

        const communityEntryData = communityEntryDoc.data();
        const votesToRemove = communityEntryData?.voteCount || 0;

        // Delete comments subcollection first
        const commentsSnapshot = await communityEntryRef.collection('comments').get();
        const batch = communityEntryRef.firestore.batch();

        // 1. Delete comments
        commentsSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));

        // 2. Delete entry
        batch.delete(communityEntryRef);

        // 3. Update creator's stats
        const creatorRef = adminDb.collection('users').doc(userId);
        const updates: any = {
            publishedCount: FieldValue.increment(-1)
        };
        if (votesToRemove > 0) {
            updates.totalInfluence = FieldValue.increment(-votesToRemove);
        }

        if (creatorRef.firestore.databaseId === communityEntryRef.firestore.databaseId) {
            batch.set(creatorRef, updates, { merge: true });
        } else {
            await creatorRef.set(updates, { merge: true });
        }

        await batch.commit();

        // Update original image if it exists — clear both new and legacy published fields
        if (imageDoc.exists) {
            await imageRef.update({
                publishedToCommunity: false,
                communityEntryId: FieldValue.delete(),
                publishedToLeague: false,
                leagueEntryId: FieldValue.delete(),
            });
        }

        return {
            message: 'Image removed from community.',
        };
    }
}
