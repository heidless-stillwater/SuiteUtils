import { GeneratedImage } from './types';

/**
 * Normalizes image data from Firestore, ensuring backward compatibility
 * for field name changes (e.g., League -> Community).
 */
export function normalizeImageData(data: any, docId: string): GeneratedImage {
    const imageData = { ...data, id: docId };

    // 1. Map old collectionId to collectionIds array
    if (imageData.collectionId && (imageData.collectionIds === undefined || imageData.collectionIds === null)) {
        imageData.collectionIds = [imageData.collectionId];
    }
    if (!imageData.collectionIds) {
        imageData.collectionIds = [];
    }

    // 2. Map old League fields to new Community fields
    if (imageData.publishedToCommunity === undefined) {
        imageData.publishedToCommunity = imageData.publishedToLeague ?? false;
    }
    if (imageData.communityEntryId === undefined) {
        imageData.communityEntryId = imageData.leagueEntryId;
    }

    // 3. Title is left as-is (undefined if not set).
    // Display fallback '<no title>' should ONLY be applied in the UI/JSX layer.

    return imageData as GeneratedImage;
}
