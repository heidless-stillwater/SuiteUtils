import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { profileUpdateSchema } from '@/lib/validations/user';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        let userId: string;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // 1. Zod Validation
        const result = profileUpdateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({
                error: result.error.issues[0].message,
                details: result.error.issues
            }, { status: 400 });
        }

        const validatedData = result.data;

        // 2. Uniqueness Check (External dependency)
        if (validatedData.username) {
            const usernameTrimmed = validatedData.username.trim().toLowerCase();

            // Check uniqueness
            const existingUserQuery = await adminDb.collection('users')
                .where('username', '==', usernameTrimmed)
                .limit(1)
                .get();

            if (!existingUserQuery.empty && existingUserQuery.docs[0].id !== userId) {
                return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
            }
        }

        const updateData: any = {
            updatedAt: Timestamp.now()
        };

        // 3. Map validated data to update object
        if (validatedData.displayName !== undefined) updateData.displayName = validatedData.displayName;
        if (validatedData.username !== undefined) updateData.username = validatedData.username;
        if (validatedData.bio !== undefined) updateData.bio = validatedData.bio;
        if (validatedData.socialLinks !== undefined) updateData.socialLinks = validatedData.socialLinks;
        if (validatedData.bannerUrl !== undefined) updateData.bannerUrl = validatedData.bannerUrl;
        if (validatedData.photoURL !== undefined) updateData.photoURL = validatedData.photoURL;

        await adminDb.collection('users').doc(userId).update(updateData);

        return NextResponse.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error: any) {
        console.error('[API] Profile Update Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to update profile'
        }, { status: 500 });
    }
}
