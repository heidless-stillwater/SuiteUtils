// Admin Community Backfill API — Re-syncs all community entries with fresh source image + author data
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication (Admin/SU only)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin' && userData?.role !== 'su') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch ALL community entries
        const entriesSnapshot = await adminDb.collection('leagueEntries').get();
        const totalEntries = entriesSnapshot.size;

        if (totalEntries === 0) {
            return NextResponse.json({ success: true, message: 'No community entries found', updated: 0, total: 0 });
        }

        // Collect unique user IDs and image references
        const userIds = new Set<string>();
        const entries = entriesSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            userIds.add(data.originalUserId);
            return { id: doc.id, data };
        });

        // Batch-fetch all unique user profiles
        const profileMap: Record<string, any> = {};
        const userIdArray = Array.from(userIds);

        // Firestore getAll supports up to 100 refs at a time
        for (let i = 0; i < userIdArray.length; i += 100) {
            const batch = userIdArray.slice(i, i + 100);
            const refs = batch.map(uid => adminDb.collection('users').doc(uid));
            const docs = await adminDb.getAll(...refs);
            docs.forEach((doc: any) => {
                if (doc.exists) {
                    profileMap[doc.id] = doc.data();
                }
            });
        }

        // Process entries and build batch updates
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const updateLog: string[] = [];

        // Firestore batches are limited to 500 operations
        const batches: FirebaseFirestore.WriteBatch[] = [];
        let currentBatch = adminDb.batch();
        let opsInBatch = 0;

        for (const entry of entries) {
            try {
                const { originalUserId, originalImageId } = entry.data;
                const updates: Record<string, any> = {};
                let hasChanges = false;

                // 1. Sync author profile data
                const freshProfile = profileMap[originalUserId];
                if (freshProfile) {
                    if (freshProfile.displayName && freshProfile.displayName !== entry.data.authorName) {
                        updates.authorName = freshProfile.displayName;
                        hasChanges = true;
                    }
                    // Always sync photoURL — it might have been null before
                    if (freshProfile.photoURL !== undefined && freshProfile.photoURL !== entry.data.authorPhotoURL) {
                        updates.authorPhotoURL = freshProfile.photoURL || null;
                        hasChanges = true;
                    }
                    if (freshProfile.badges && JSON.stringify(freshProfile.badges) !== JSON.stringify(entry.data.authorBadges || [])) {
                        updates.authorBadges = freshProfile.badges;
                        hasChanges = true;
                    }
                }

                // 2. Sync source image data (videoUrl, duration, thumbnailUrl)
                if (originalUserId && originalImageId) {
                    try {
                        const imageDoc = await adminDb
                            .collection('users')
                            .doc(originalUserId)
                            .collection('images')
                            .doc(originalImageId)
                            .get();

                        if (imageDoc.exists) {
                            const imageData = imageDoc.data()!;

                            // Sync videoUrl if missing on community hub entry
                            if (imageData.videoUrl && !entry.data.videoUrl) {
                                updates.videoUrl = imageData.videoUrl;
                                hasChanges = true;
                            }

                            // Sync duration if missing
                            if (imageData.duration && !entry.data.duration) {
                                updates.duration = imageData.duration;
                                hasChanges = true;
                            }

                            // Sync imageUrl if source has a thumbnail (non-mp4 imageUrl)
                            // and league entry imageUrl is still a .mp4
                            const entryImgIsVideo = /\.(mp4|webm|mov)(\?|$)/i.test(entry.data.imageUrl || '');
                            const sourceImgIsVideo = /\.(mp4|webm|mov)(\?|$)/i.test(imageData.imageUrl || '');
                            if (entryImgIsVideo && !sourceImgIsVideo && imageData.imageUrl) {
                                updates.imageUrl = imageData.imageUrl;
                                hasChanges = true;
                            }

                            // Sync settings.modality if missing
                            if (imageData.settings?.modality && !entry.data.settings?.modality) {
                                updates.settings = { ...entry.data.settings, modality: imageData.settings.modality };
                                hasChanges = true;
                            }
                        }
                    } catch (imgErr) {
                        // Source image might have been deleted — skip silently
                    }
                }

                if (hasChanges) {
                    const entryRef = adminDb.collection('leagueEntries').doc(entry.id);
                    currentBatch.update(entryRef, updates);
                    opsInBatch++;
                    updated++;

                    updateLog.push(`${entry.id}: ${Object.keys(updates).join(', ')}`);

                    // Flush batch at 450 ops (leave room for safety)
                    if (opsInBatch >= 450) {
                        batches.push(currentBatch);
                        currentBatch = adminDb.batch();
                        opsInBatch = 0;
                    }
                } else {
                    skipped++;
                }
            } catch (entryErr: any) {
                errors++;
                console.error(`[Backfill] Error processing entry ${entry.id}:`, entryErr.message);
            }
        }

        // Commit remaining batch
        if (opsInBatch > 0) {
            batches.push(currentBatch);
        }

        // Execute all batches
        for (const batch of batches) {
            await batch.commit();
        }

        console.log(`[Backfill] Complete: ${updated} updated, ${skipped} skipped, ${errors} errors out of ${totalEntries} total`);

        return NextResponse.json({
            success: true,
            message: `Backfill complete`,
            total: totalEntries,
            updated,
            skipped,
            errors,
            details: updateLog.slice(0, 50) // Return first 50 update descriptions
        });

    } catch (error: any) {
        console.error('[Admin Community Backfill] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
