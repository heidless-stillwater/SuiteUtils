
import dotenv from 'dotenv';
import path from 'path';
import { getNanoBananaService } from './src/lib/services/nanobanana';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
    console.log('🚀 [Tier 1 Verification] Starting Direct Service Probe...');
    console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT || 'Not set');
    
    try {
        const service = await getNanoBananaService();
        console.log('📡 [Tier 1 Verification] Service Initialized. Sending strike to AI Studio...');
        
        const result = await service.generateImage({
            prompt: 'A cinematic high-fidelity image of a sovereign AI core, neon blue and chrome, 8k resolution',
            aspectRatio: '1:1',
            count: 1,
            onStatus: (msg) => console.log(`   [Status] ${msg}`),
            onProgress: (cur, tot) => console.log(`   [Progress] ${cur}/${tot}`)
        });
        
        if (result.success) {
            console.log('✅ [SUCCESS] Generation complete!');
            console.log('Images found:', result.images.length);
            console.log('Image Data Sample:', result.images[0].substring(0, 50) + '...');
        } else {
            console.error('❌ [FAILED] Generation failed:', result.error);
        }
    } catch (err: any) {
        console.error('💥 [CRASH] Execution error:', err.message);
    }
}

verify();
