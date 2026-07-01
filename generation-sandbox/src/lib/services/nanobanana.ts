import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { AspectRatio, ImageQuality } from '../types';
import { getSecret } from '../config-helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface SlotStats {
    success: number;
    failure: number;
    blacklisted: boolean;
    lastAttempt?: number;
}

class ReliabilityTracker {
    private statsPath: string;
    private stats: Record<string, SlotStats> = {};

    constructor() {
        this.statsPath = path.join(os.homedir(), '.config', 'persona', 'nanobanana_stats.json');
        this.load();
    }

    private load() {
        try {
            if (fs && fs.existsSync && fs.existsSync(this.statsPath)) {
                this.stats = JSON.parse(fs.readFileSync(this.statsPath, 'utf8'));
            }
        } catch (e) {
            console.error('[ReliabilityTracker] Failed to load stats:', e);
        }
    }

    private save() {
        try {
            const dir = path.dirname(this.statsPath);
            if (fs && fs.mkdirSync && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (fs && fs.writeFileSync) fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
        } catch (e) {
            console.error('[ReliabilityTracker] Failed to save stats:', e);
        }
    }

    recordSuccess(slotId: string) {
        if (!this.stats[slotId]) this.stats[slotId] = { success: 0, failure: 0, blacklisted: false };
        this.stats[slotId].success++;
        this.stats[slotId].lastAttempt = Date.now();
        this.save();
    }

    recordFailure(slotId: string, isPermanent = false) {
        if (!this.stats[slotId]) this.stats[slotId] = { success: 0, failure: 0, blacklisted: false };
        this.stats[slotId].failure++;
        this.stats[slotId].lastAttempt = Date.now();
        if (isPermanent) this.stats[slotId].blacklisted = true;
        this.save();
    }

    getScore(slotId: string): number {
        const s = this.stats[slotId];
        if (s?.blacklisted) return -1;
        if (!s || (s.success === 0 && s.failure === 0)) return 0.5;
        return s.success / (s.success + s.failure);
    }

    isBlacklisted(slotId: string): boolean {
        return this.stats[slotId]?.blacklisted || false;
    }
}

// Model selection based on quality
const MODELS = {
    standard: 'imagen-4.0-generate-001',
    high: 'imagen-4.0-generate-001',
    ultra: 'imagen-4.0-generate-001',
} as const;

const GENERATIVE_LANGUAGE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

// Resolution by quality
const RESOLUTIONS = {
    standard: undefined, // Default 1024px
    high: '2K',
    ultra: '4K',
} as const;

interface GenerateImageOptions {
    prompt: string;
    quality: ImageQuality;
    aspectRatio: AspectRatio;
    count?: number;
    seed?: number;
    negativePrompt?: string;
    guidanceScale?: number;
    referenceImage?: string;    // Base64 image data for Img2Img variations
    referenceMimeType?: string; // MIME type of reference image (default: image/png)
    referenceImages?: Array<{ data: string, mimeType: string }>; // Multiple reference images
    onProgress?: (current: number, total: number) => void;
    onStatus?: (message: string) => void;
    onConsentRequired?: (metadata: { projectId: string, location: string, model: string }) => Promise<boolean>;
    signal?: AbortSignal;
}

export interface ImageResult {
    data: string;
    mimeType: string;
}

export interface GenerateImageResult {
    success: boolean;
    images?: ImageResult[];
    error?: string;
}

export class NanoBananaService {
    private client: GoogleGenAI; // AI Studio client (for images)
    private vertexClient: GoogleGenAI | null = null; // Vertex AI client (for video/image)
    private apiKey: string;
    private tracker: ReliabilityTracker;
    private consentedRegions: Set<string> = new Set();

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
        this.apiKey = apiKey;
        this.tracker = new ReliabilityTracker();
    }

    private async getVertexClient(): Promise<GoogleGenAI> {
        if (this.vertexClient) return this.vertexClient;

        const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'stillwater-sovereign-02';
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

        console.log(`[NanoBanana] Initializing Vertex AI client for project: ${projectId} in ${location}`);
        
        this.vertexClient = new GoogleGenAI({
            vertexai: true,
            project: projectId,
            location: location
        });

        return this.vertexClient;
    }

    private async getVertexAccessToken(): Promise<string> {
        try {
            const auth = new GoogleAuth({
                scopes: 'https://www.googleapis.com/auth/cloud-platform'
            });
            const client = await auth.getClient();
            const tokenResponse = await client.getAccessToken();
            if (tokenResponse.token) {
                console.log('[NanoBanana] Successfully acquired Suite Owner Access Token via GoogleAuth.');
                return tokenResponse.token;
            }
        } catch (err: any) {
            console.error('[NanoBanana] GoogleAuth token acquisition failed:', err.message);
        }
        return '';
    }

    async generateVideo(options: {
        prompt: string;
        aspectRatio: AspectRatio;
        onProgress?: (current: number, total: number) => void;
        onStatus?: (message: string) => void;
        signal?: AbortSignal;
    }): Promise<GenerateImageResult> {
        const { prompt, aspectRatio, onProgress, onStatus, signal } = options;
        const baseModel = 'veo-2.0-generate-001';
        const regions = ['us-central1', 'us-east1', 'europe-west1', 'asia-northeast1', 'us-west1', 'europe-west4'];
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'stillwater-sovereign-02';

        // Flatten and rank slots
        const slots = regions.map(location => ({
            location,
            projectId,
            model: baseModel,
            id: `${projectId}:${location}:${baseModel}`
        })).filter(slot => !this.tracker.isBlacklisted(slot.id))
           .sort((a, b) => {
               // Prioritize us-central1 initially, then by reliability
               if (a.location === 'us-central1' && this.tracker.getScore(a.id) >= 0.5) return -1;
               if (b.location === 'us-central1' && this.tracker.getScore(b.id) >= 0.5) return 1;
               return this.tracker.getScore(b.id) - this.tracker.getScore(a.id);
           });

        for (const slot of slots) {
            if (signal?.aborted) return { success: false, error: 'Generation cancelled' };
            const { location, model } = slot;
            try {
                if (onStatus) onStatus(`Initializing Video Engine (${location})...`);
                console.log(`[NanoBanana] Attempting Veo generation in ${location}...`);
                
                const accessToken = await this.getVertexAccessToken();
                const vClient = new GoogleGenAI({
                    httpOptions: {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    },
                    vertexai: true,
                    project: projectId,
                    location: location
                });

                const aspectRatioMap: Record<AspectRatio, "16:9" | "9:16" | "1:1"> = {
                    '16:9': '16:9', '9:16': '9:16', '1:1': '1:1', '4:3': '16:9', '3:4': '9:16',
                };
                const veoAspectRatio = aspectRatioMap[aspectRatio] || '16:9';

                if (onStatus) onStatus(`Starting video generation in ${location}...`);

                let operation = await vClient.models.generateVideos({
                    model: model,
                    prompt: prompt,
                    config: { aspectRatio: veoAspectRatio }
                });

                console.log(`[NanoBanana] Video Operation Started in ${location}:`, operation.name);
                if (onStatus) onStatus(`Generation in progress (${location})...`);

                const startTime = Date.now();
                const timeout = 600000; 

                while (!operation.done) {
                    if (Date.now() - startTime > timeout) throw new Error('Video generation timed out');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    operation = await vClient.operations.getVideosOperation({ operation });
                    if (onProgress) onProgress(0, 1);
                }

                if (operation.error) throw new Error(`Veo Generation Failed: ${JSON.stringify(operation.error)}`);

                console.log(`[NanoBanana] Successfully generated video in ${location}.`);
                this.tracker.recordSuccess(slot.id);

                const rawResp = (operation as any).response || operation;
                const resp = JSON.parse(JSON.stringify(rawResp));
                const genVideos = resp.generatedVideos || resp.generated_videos;
                const videoObj = genVideos?.[0]?.video || genVideos?.[0];
                
                let videoData = videoObj?.videoBytes || videoObj?.data;
                let videoUri = videoObj?.uri;
                let mimeType = videoObj?.mimeType || 'video/mp4';

                if (!videoData && !videoUri) {
                    const findValue = (obj: any, key: string): any => {
                        if (!obj || typeof obj !== 'object') return null;
                        if (obj[key]) return obj[key];
                        for (const k of Object.keys(obj)) {
                            const val = findValue(obj[k], key);
                            if (val) return val;
                        }
                        return null;
                    };
                    videoData = findValue(resp, 'videoBytes') || findValue(resp, 'data');
                    videoUri = findValue(resp, 'uri');
                }

                if (videoData) return { success: true, images: [{ data: videoData, mimeType: mimeType }] };

                if (videoUri) {
                    if (onStatus) onStatus(`Downloading video...`);
                    const accessToken = await this.getVertexAccessToken();
                    return this.downloadVideo(videoUri, accessToken);
                }

                throw new Error(`Failed to find video data in response.`);

            } catch (error: any) {
                const errorStr = JSON.stringify(error).toLowerCase();
                const isPermanent = errorStr.includes('404') || errorStr.includes('not found') || errorStr.includes('permission_denied');
                this.tracker.recordFailure(slot.id, isPermanent);
                
                const isRetryable = errorStr.includes('429') || errorStr.includes('quota') || isPermanent;
                
                if (isRetryable && slot !== slots[slots.length - 1]) {
                    console.warn(`[NanoBanana] ${location} failed (${isPermanent ? 'Permanent' : 'Quota'}). Failover...`);
                    continue; 
                }
                
                console.error(`Vertex Veo error in ${location}:`, error);
                return { success: false, error: error.message || 'Video generation failed' };
            }
        }
        return { success: false, error: 'All regions exhausted quota' };
    }

    private async downloadVideo(videoUri: string, accessToken: string): Promise<GenerateImageResult> {
        try {
            let downloadUrl = videoUri;
            
            if (videoUri.startsWith('gs://')) {
                const parts = videoUri.replace('gs://', '').split('/');
                const bucket = parts.shift();
                const path = parts.join('/');
                downloadUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
            }

            const videoRes = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!videoRes.ok) throw new Error(`Failed to download video content: ${videoRes.statusText}`);

            const videoBuffer = await videoRes.arrayBuffer();
            return {
                success: true,
                images: [{
                    data: Buffer.from(videoBuffer).toString('base64'),
                    mimeType: 'video/mp4'
                }]
            };
        } catch (error: any) {
            throw new Error(`Video download failed: ${error.message}`);
        }
    }

    async generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
        this.consentedRegions.clear();
        const { prompt, quality = 'standard', aspectRatio = '1:1', count = 1, onProgress, onStatus } = options;
        
        // --- SINGLE STRIKE CONFIGURATION ---
        // We prioritize the most typically reliable path: heidless-apps-3
        const primaryProject = process.env.GOOGLE_CLOUD_PROJECT || 'stillwater-sovereign-02';
        const primaryRegion = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        const primaryModel = 'imagen-4.0-generate-001';

        console.log(`[NanoBanana] SINGLE_STRIKE: Targeting ${primaryProject} in ${primaryRegion} with ${primaryModel}`);
        if (onStatus) onStatus(`Initializing single-strike generation on ${primaryRegion}...`);

        const attemptGeneration = async (projectId: string, location: string, model: string) => {
            const accessToken = await this.getVertexAccessToken();
            const vClient = new GoogleGenAI({
                httpOptions: { headers: { 'Authorization': `Bearer ${accessToken}` } },
                vertexai: true,
                project: projectId,
                location: location
            });
            
            console.log(`[NanoBanana] [${projectId}] [${location}] [${model}] Strike Start...`);
            
            try {
                const response = await vClient.models.generateContent({
                    model: model,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                });

                const unwrapped = JSON.parse(JSON.stringify(response));
                const result = unwrapped.response || unwrapped;
                
                const images: ImageResult[] = [];
                const candidates = result.predictions || result.candidates || [];
                
                const deepSearch = (obj: any, key: string): any => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj[key]) return obj[key];
                    for (const k of Object.keys(obj)) {
                        const val = deepSearch(obj[k], key);
                        if (val) return val;
                    }
                    return null;
                };

                for (const candidate of candidates) {
                    const data = deepSearch(candidate, 'bytesBase64Encoded') || 
                                 deepSearch(candidate, 'data') || 
                                 deepSearch(candidate, 'inlineData')?.data;
                    
                    if (data) {
                        images.push({ 
                            data, 
                            mimeType: deepSearch(candidate, 'mimeType') || 'image/png' 
                        });
                    }
                }

                if (images.length === 0) throw new Error('No image data found in Vertex response');
                console.log(`[NanoBanana] [${location}] [${model}] SUCCESS`);
                return images;
            } catch (err: any) {
                const errMsg = err.message || JSON.stringify(err);
                console.error(`[NanoBanana] [${projectId}] [${location}] [${model}] Failed: ${errMsg.substring(0, 200)}`);
                throw err;
            }
        };

        try {
            // --- PRIMARY STRIKE: AI Studio (Nano Banana) ---
            // High capacity Tier 1 path.
            console.log(`[NanoBanana] Executing Primary Strike via AI Studio REST...`);
            if (onStatus) onStatus('Executing Primary Strike via AI Studio...');
            
            const aiStudioResult = await this.tryAIStudio(prompt);
            if (aiStudioResult.success) {
                if (onProgress) onProgress(count, count);
                return aiStudioResult;
            }
            throw new Error(aiStudioResult.error || 'AI Studio failed');
        } catch (err: any) {
            const errorMsg = (err.message || err.toString() || '').toLowerCase();
            console.warn(`[NanoBanana] Primary Strike (AI Studio) Failed: ${errorMsg.substring(0, 100)}`);
            
            // --- SECONDARY FALLBACK: Vertex AI ---
            // Our previous primary is now the safety net.
            if (onStatus) onStatus(`Falling back to Vertex (heidless-apps-3)...`);
            try {
                const images = await attemptGeneration(primaryProject, primaryRegion, primaryModel);
                if (onProgress) onProgress(count, count);
                return { success: true, images };
            } catch (vError: any) {
                console.error(`[NanoBanana] ALL STRIKES FAILED`);
                return { success: false, error: `Generation failed: ${vError.message}` };
            }
        }
    }

    private async tryAIStudio(prompt: string): Promise<{ success: boolean; images: any[]; error?: string }> {
        try {
            console.log(`[NanoBanana] Attempting AI Studio REST (Nano Banana)...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${this.apiKey}`;
            const fbResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                })
            });
            
            const fbData = await fbResponse.json();
            
            if (!fbResponse.ok) {
                const errorDetail = JSON.stringify(fbData);
                console.error(`[NanoBanana] AI Studio REST API error (${fbResponse.status}): ${errorDetail}`);
                return { success: false, images: [], error: `AI Studio Error: ${fbResponse.status} - ${errorDetail}` };
            }

            const deepSearch = (obj: any, key: string): any => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj[key]) return obj[key];
                for (const k of Object.keys(obj)) {
                    const val = deepSearch(obj[k], key);
                    if (val) return val;
                }
                return null;
            };

            const imgData = deepSearch(fbData, 'bytesBase64Encoded') || 
                            deepSearch(fbData, 'data') || 
                            deepSearch(fbData, 'inlineData')?.data;

            if (imgData) {
                console.log(`[NanoBanana] SUCCESS via AI Studio REST (Nano Banana)`);
                return { 
                    success: true, 
                    images: [{ 
                        data: imgData, 
                        mimeType: 'image/png' 
                    }] 
                };
            } else {
                const errorMsg = fbData.error?.message || 'No image data in response';
                console.warn(`[NanoBanana] AI Studio REST failed: ${errorMsg}`);
                return { success: false, images: [], error: errorMsg };
            }
        } catch (err: any) {
            console.error(`[NanoBanana] AI Studio REST error:`, err.message);
            return { success: false, images: [], error: err.message };
        }
    }

    async probe(): Promise<Record<string, { status: 'online' | 'offline', error?: string }>> {
        return {};
    }
}

let nanoBananaService: NanoBananaService | null = null;
export async function getNanoBananaService(): Promise<NanoBananaService> {
    if (!nanoBananaService) {
        const { getSecret } = await import('../config-helper');
        const apiKey = await getSecret('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
        nanoBananaService = new NanoBananaService(apiKey);
    }
    return nanoBananaService;
}
