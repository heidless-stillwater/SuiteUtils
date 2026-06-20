import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; 
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Global queue to handle interactive failover consent
// Using global to survive HMR in local development
const globalAny: any = global;
if (!globalAny.__consentQueue) globalAny.__consentQueue = new Map<string, (approved: boolean) => void>();
const consentQueue = globalAny.__consentQueue;

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function PATCH(request: NextRequest) {
    try {
        const { requestId, approved } = await request.json();
        const resolve = consentQueue.get(requestId);
        if (resolve) {
            resolve(approved);
            consentQueue.delete(requestId);
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }
        return NextResponse.json({ error: 'Request not found or expired' }, { status: 404, headers: CORS_HEADERS });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function POST(request: NextRequest) {
    console.log('[PromptTool API] REQUEST_START: Incoming generation request');
    const requestId = Math.random().toString(36).substring(7);
    
    try {
        // Dynamic imports to prevent top-level initialization crashes during OPTIONS preflights
        const { adminAuth } = await import('@/lib/firebase-admin');
        const { getNanoBananaService } = await import('@/lib/services/nanobanana');
        const { GenerationService } = await import('@/lib/services/generation');
        const { generationSchema } = await import('@/lib/validations/generation');

        // ... [AUTH LOGIC REMAINS SAME] ...
        const authHeader = request.headers.get('Authorization');
        let userId: string;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decodedToken = await adminAuth.verifyIdToken(token);
            userId = decodedToken.uid;
        } else {
            const sessionCookie = request.cookies.get('session')?.value;
            if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
            const decodedCookie = await adminAuth.verifySessionCookie(sessionCookie);
            userId = decodedCookie.uid;
        }

        const body = await request.json();
        
        if (!userId && body.uid) userId = body.uid;
        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 401, headers: CORS_HEADERS });

        // --- Entitlement Check ---
        const { checkAppAccess } = await import('@/lib/entitlements');
        const hasAccess = await checkAppAccess(userId, 'studio');
        if (!hasAccess) {
            return NextResponse.json({ 
                error: 'Studio suite access required. Visit Stillwater Resources (Port 3002) to upgrade your account.' 
            }, { status: 403, headers: CORS_HEADERS });
        }

        const result = generationSchema.safeParse(body);
        if (!result.success) {
            console.error('[PromptTool API] Validation Failed:', result.error.issues);
            return NextResponse.json({ 
                error: result.error.issues[0].message,
                issues: result.error.issues,
                receivedBody: body 
            }, { status: 400, headers: CORS_HEADERS });
        }

        const validatedData = result.data;
        const { prompt, rawPrompt, quality, aspectRatio, modality, count, seed, negativePrompt, guidanceScale, referenceImage, referenceImageUrl, referenceMimeType, referenceImages, sourceImageId, promptSetID, collectionIds, title, variables, template } = validatedData;

        await GenerationService.validateTier(userId, validatedData);
        const validation = await GenerationService.validateCredits(userId, modality as any, quality as any, count);
        
        const isUsingAdvanced = seed !== undefined || (negativePrompt?.trim() !== '') || (guidanceScale !== undefined && guidanceScale !== 7.0);

        const encoder = new TextEncoder();
        const transformStream = new TransformStream();
        const writer = transformStream.writable.getWriter();
        const sendEvent = async (data: any) => { 
            try {
                if (writer && !request.signal.aborted) {
                    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); 
                }
            } catch (e) {
                // Ignore write errors
            }
        };

        // Persistent Heartbeat to keep SSE connection alive during long silent hunts
        const globalHeartbeat = setInterval(() => {
            sendEvent({ type: 'heartbeat', timestamp: Date.now() });
        }, 15000);

        (async () => {
            try {
                const nanoBananaService = await getNanoBananaService();
                let genResult;

                if (modality === 'video') {
                    genResult = await nanoBananaService.generateVideo({
                        prompt, aspectRatio,
                        onProgress: (current, total) => sendEvent({ type: 'progress', current, total, message: `Generating video...` }),
                        onStatus: (message) => sendEvent({ type: 'progress', message }),
                        signal: request.signal
                    });
                } else {
                    genResult = await nanoBananaService.generateImage({
                        prompt, quality: quality as any, aspectRatio, count,
                        seed: seed ?? undefined, negativePrompt: negativePrompt ?? undefined, guidanceScale: guidanceScale ?? undefined,
                        referenceImage: referenceImage ?? undefined, referenceMimeType: referenceMimeType ?? undefined,
                        referenceImages: referenceImages ?? undefined,
                        onProgress: (current, total) => sendEvent({ type: 'progress', current, total, message: `Generated ${current} of ${total} images...` }),
                        onStatus: (message) => sendEvent({ type: 'progress', message }),
                        onConsentRequired: async (metadata) => {
                            if (request.signal.aborted) return false;
                            
                            console.log(`[PromptTool API] INTERRUPT: Consent Required for failover to ${metadata.location}. Awaiting user PATCH...`);
                            await sendEvent({ type: 'consent_required', requestId, metadata });
                            
                            try {
                                return await new Promise((resolve) => {
                                    consentQueue.set(requestId, resolve);
                                    
                                    // Timeout after 10 minutes of user inactivity during consent
                                    const timeout = setTimeout(() => {
                                        if (consentQueue.has(requestId)) {
                                            console.warn(`[PromptTool API] TIMEOUT: Consent wait for ${requestId} expired.`);
                                            resolve(false);
                                            consentQueue.delete(requestId);
                                        }
                                    }, 600000);

                                    // If request is aborted while waiting, resolve false immediately
                                    request.signal.addEventListener('abort', () => {
                                        clearTimeout(timeout);
                                        resolve(false);
                                        consentQueue.delete(requestId);
                                    }, { once: true });
                                });
                            } catch (e) {
                                return false;
                            }
                        },
                        signal: request.signal
                    });
                }

                if (request.signal.aborted) {
                    console.log(`[PromptTool API] ABORTED: Hunt terminated for ${requestId}`);
                    return;
                }

                if (!genResult.success || !genResult.images?.length) {
                    await sendEvent({ type: 'error', error: genResult.error || 'Generation failed' });
                    return;
                }

                const generatedMediaData = [];
                for (let i = 0; i < genResult.images.length; i++) {
                    const mediaData = await GenerationService.saveMedia(userId, genResult.images[i], {
                        prompt: prompt, rawPrompt: rawPrompt || prompt, quality: quality as any, aspectRatio, promptType: validatedData.promptType as any,
                        madlibsData: validatedData.madlibsData as any, seed: seed ?? undefined, negativePrompt: negativePrompt ?? undefined,
                        guidanceScale: guidanceScale ?? undefined, sourceImageId: sourceImageId ?? undefined,
                        promptSetID: promptSetID ?? undefined, collectionIds: collectionIds ?? undefined,
                        requestedModality: modality as any, modality: modality as any, initialImageUrl: referenceImageUrl ?? undefined,
                        targetVariationId: i === 0 ? validatedData.targetVariationId : undefined,
                        title: title ?? undefined,
                        variables: variables as any,
                        template: template as any
                    });
                    generatedMediaData.push(mediaData);
                    await sendEvent({ type: 'image_ready', image: mediaData, index: i });
                }

                const newBalance = await GenerationService.deductCredits(validation, genResult.images.length, {
                    modality, quality: quality as any, aspectRatio, promptType: validatedData.promptType, isAdvanced: isUsingAdvanced,
                    prompt, firstImageUrl: generatedMediaData[0]?.imageUrl
                });

                await sendEvent({
                    type: 'complete',
                    success: true,
                    creditsUsed: validation.costs.single * genResult.images.length,
                    remainingBalance: newBalance,
                });
            } catch (err: any) {
                console.error('SSE Error:', err);
                if (!request.signal.aborted) {
                    await sendEvent({ type: 'error', error: err.message || 'Generation processor error' });
                }
            } finally {
                clearInterval(globalHeartbeat);
                try { await writer.close(); } catch (e) { /* ignore */ }
                consentQueue.delete(requestId);
            }
        })();

        return new NextResponse(transformStream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...CORS_HEADERS
            },
        });

    } catch (error: any) {
        console.error('Critical API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
    }
}
