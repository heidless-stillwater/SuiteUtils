import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRINCIPLES_PATH = path.join(__dirname, '../OPERATING_PRINCIPLES.md');
const PROFILE_PATH = '/home/heidless/.config/persona/profile.json';

async function syncPrinciples() {
    console.log('🛰️ Starting Principle Synchronization...');

    try {
        if (!await fs.pathExists(PRINCIPLES_PATH)) {
            throw new Error(`Principles file not found at ${PRINCIPLES_PATH}`);
        }

        const content = await fs.readFile(PRINCIPLES_PATH, 'utf-8');
        
        // Extract bullet points from the "CORE PRINCIPLES" section
        const principlesMatch = content.match(/## ⚖️ CORE PRINCIPLES\n([\s\S]*?)(?=\n##|$)/);
        if (!principlesMatch) {
            throw new Error('Could not find CORE PRINCIPLES section in markdown.');
        }

        const principles = principlesMatch[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.substring(1).trim());

        if (principles.length === 0) {
            console.warn('⚠️ No principles found in markdown.');
        }

        // Load and update profile.json
        const profile = await fs.readJson(PROFILE_PATH);
        profile.principles = principles;
        profile.lastSyncAt = new Date().toISOString();

        await fs.writeJson(PROFILE_PATH, profile, { spaces: 2 });
        
        console.log(`✅ Synchronization Complete. ${principles.length} principles exported to persona profile.`);
        console.log(`🛰️ Profile updated at: ${PROFILE_PATH}`);
    } catch (error) {
        console.error('❌ Sync Failed:', error);
        process.exit(1);
    }
}

syncPrinciples();
