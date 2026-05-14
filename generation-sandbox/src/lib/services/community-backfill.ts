
import { db } from '../firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

/**
 * Initializes missing metrics on existing league entries.
 * Useful when new features (like following or sharing) are added.
 */
export async function backfillCommunityMetrics() {
    console.log('[Backfill] Starting community entry metrics sync...');
    try {
        const snapshot = await getDocs(collection(db, 'leagueEntries'));
        const batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach(snapshotDoc => {
            const data = snapshotDoc.data();
            const updates: any = {};

            // Initialize new metrics to 0 if they do not exist
            if (data.authorFollowerCount === undefined) updates.authorFollowerCount = 0;
            if (data.shareCount === undefined) updates.shareCount = 0;
            if (data.commentCount === undefined) updates.commentCount = 0;
            if (data.variationCount === undefined) updates.variationCount = 0;
            if (data.voteCount === undefined) updates.voteCount = 0;

            if (Object.keys(updates).length > 0) {
                batch.update(snapshotDoc.ref, updates);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`[Backfill] Successfully updated ${count} entries.`);
            return count;
        } else {
            console.log('[Backfill] All entries are already up to date.');
            return 0;
        }
    } catch (err) {
        console.error('[Backfill] Failed:', err);
        throw err;
    }
}
