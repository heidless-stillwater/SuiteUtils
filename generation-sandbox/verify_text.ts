
import dotenv from 'dotenv';
import path from 'path';
import { getNanoBananaService } from './src/lib/services/nanobanana';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function probe() {
    console.log('🚀 [Tier 1 Probe] Testing Text Generation...');
    try {
        const service = await getNanoBananaService();
        console.log('📡 Service Initialized.');
        
        // Use a tiny prompt to minimize token usage
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Hello' }] }]
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log('✅ [SUCCESS] AI Studio Text Probe OK.');
        } else {
            console.error('❌ [FAILED] AI Studio Text Probe:', data.error);
        }
    } catch (err: any) {
        console.error('💥 [CRASH] Probe error:', err.message);
    }
}

probe();
