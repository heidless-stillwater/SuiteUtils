
import { adminDb } from '../firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface FollowOptions {
    currentUserId: string;
    targetUserId: string;
}

export class UserService {
    /**
     * Follows a target user.
     */
    static async followUser({ currentUserId, targetUserId }: FollowOptions) {
        if (currentUserId === targetUserId) {
            throw new Error('You cannot follow yourself');
        }

        const currentUserRef = adminDb.collection('users').doc(currentUserId);
        const targetUserRef = adminDb.collection('users').doc(targetUserId);

        const followingRef = currentUserRef.collection('following').doc(targetUserId);
        const followerRef = targetUserRef.collection('followers').doc(currentUserId);

        const followingDoc = await followingRef.get();
        if (followingDoc.exists) {
            throw new Error('Already following this user');
        }

        // Get user profiles for denormalized data
        const [currentUserDoc, targetUserDoc] = await Promise.all([
            currentUserRef.get(),
            targetUserRef.get()
        ]);

        if (!targetUserDoc.exists) {
            throw new Error('Target user not found');
        }

        const currentUserData = currentUserDoc.data()!;
        const targetUserData = targetUserDoc.data()!;

        const batch = adminDb.batch();

        // 1. Add to current user's following
        batch.set(followingRef, {
            uid: targetUserId,
            displayName: targetUserData.displayName || 'Anonymous',
            photoURL: targetUserData.photoURL || null,
            followedAt: Timestamp.now()
        });

        // 2. Add to target user's followers
        batch.set(followerRef, {
            uid: currentUserId,
            displayName: currentUserData.displayName || 'Anonymous',
            photoURL: currentUserData.photoURL || null,
            followedAt: Timestamp.now()
        });

        // 3. Update counts
        batch.set(currentUserRef, { followingCount: FieldValue.increment(1) }, { merge: true });
        batch.set(targetUserRef, { followerCount: FieldValue.increment(1) }, { merge: true });

        // 4. Send Notification to target
        const notifRef = targetUserRef.collection('notifications').doc();
        batch.set(notifRef, {
            userId: targetUserId,
            type: 'follow',
            actorId: currentUserId,
            actorName: currentUserData.displayName || 'Anonymous',
            actorPhotoURL: currentUserData.photoURL || null,
            read: false,
            createdAt: Timestamp.now()
        });

        await batch.commit();

        return { message: 'User followed' };
    }

    /**
     * Unfollows a target user.
     */
    static async unfollowUser({ currentUserId, targetUserId }: FollowOptions) {
        const currentUserRef = adminDb.collection('users').doc(currentUserId);
        const targetUserRef = adminDb.collection('users').doc(targetUserId);

        const followingRef = currentUserRef.collection('following').doc(targetUserId);
        const followerRef = targetUserRef.collection('followers').doc(currentUserId);

        const followingDoc = await followingRef.get();
        if (!followingDoc.exists) {
            throw new Error('Not following this user');
        }

        const batch = adminDb.batch();

        // 1. Remove from following
        batch.delete(followingRef);

        // 2. Remove from followers
        batch.delete(followerRef);

        // 3. Update counts
        batch.set(currentUserRef, { followingCount: FieldValue.increment(-1) }, { merge: true });
        batch.set(targetUserRef, { followerCount: FieldValue.increment(-1) }, { merge: true });

        await batch.commit();

        return { message: 'User unfollowed' };
    }
}
