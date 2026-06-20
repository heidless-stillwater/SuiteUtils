import { adminDb } from '../firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Calculates current weekly upvote growth for all creators.
 * Returns a map of creatorId -> weeklyVotes
 */
export async function getWeeklyGrowthStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const votesSnapshot = await adminDb.collection('votes')
        .where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
        .get();

    const stats: Record<string, number> = {};

    votesSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const authorId = data.authorId;
        if (authorId) {
            stats[authorId] = (stats[authorId] || 0) + 1;
        }
    });

    return stats;
}
