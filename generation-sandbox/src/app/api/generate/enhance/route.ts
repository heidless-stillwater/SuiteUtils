import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAIPromptService } from '@/lib/services/ai-prompt';
import { enhancePromptSchema } from '@/lib/validations/generation';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
    try {
        // 1. Auth Check
        const authHeader = request.headers.get('Authorization');
        let userId: string;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        } else {
            const sessionCookie = request.cookies.get('session')?.value;
            if (!sessionCookie) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const decodedCookie = await adminAuth.verifySessionCookie(sessionCookie);
            userId = decodedCookie.uid;
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 401 });
        }

        // 2. Validate Input
        const body = await request.json();
        const result = enhancePromptSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({
                error: result.error.issues[0].message
            }, { status: 400 });
        }

        const { prompt, style, mood } = result.data;

        // 3. Enhance Prompt via Service
        const aiService = await getAIPromptService();
        const enhancedPrompt = await aiService.enhancePrompt(prompt, style, mood);

        return NextResponse.json({
            success: true,
            original: prompt,
            enhanced: enhancedPrompt, // Keep property name 'enhanced' for frontend compatibility
        });

    } catch (error: any) {
        console.error('[API Enhance] Error:', error);
        return NextResponse.json({
            error: error.message || 'Enhancement failed'
        }, { status: 500 });
    }
}
