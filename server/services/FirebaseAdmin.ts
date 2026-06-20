import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

/**
 * Singleton-style getter for the Firebase Admin App.
 * Prioritizes environment variables for production security (Secret Manager).
 */
function getEnsuredApp(): App {
    const currentApps = getApps();
    if (currentApps.length > 0) return currentApps[0];

    const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.SERVICE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.SERVICE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.SERVICE_PROJECT_ID || 'stillwater-sovereign-01';
    
    console.log('[Firebase Admin] Target Project ID:', projectId);
    console.log('[Firebase Admin] GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT);
    console.log('[Firebase Admin] GCLOUD_PROJECT:', process.env.GCLOUD_PROJECT);
    console.log('[Firebase Admin] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

    try {
        if (privateKey && clientEmail && projectId) {
            console.log(`[Firebase Admin] Branch: Environment Credentials (Project: ${projectId})`);
            const formattedKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
            return initializeApp({
                credential: cert({ projectId, clientEmail, privateKey: formattedKey }),
                projectId
            });
        } 
        
        // Fallback: Check for local service account file (dev only, excluded via .gitignore)
        const conventionPaths = [
            path.join(process.cwd(), 'server', 'config', 'service-account.json'),
            path.join(process.cwd(), 'suite-admin-sovereign.json')
        ];

        for (const localSaPath of conventionPaths) {
            if (fs.existsSync(localSaPath)) {
                console.log(`[Firebase Admin] Branch: Local SA File (Path: ${localSaPath})`);
                const sa = JSON.parse(fs.readFileSync(localSaPath, 'utf8'));
                console.log(`[Firebase Admin] SA File Project ID: ${sa.project_id}`);
                return initializeApp({
                    credential: cert(localSaPath),
                    projectId: sa.project_id || projectId
                });
            }
        }

        console.log(`[Firebase Admin] Branch: ADC (Project: ${projectId})`);
        return initializeApp({ projectId });
    } catch (error: any) {
        console.error('[Firebase Admin] Initialization failure:', error.message);
        throw error;
    }
}

export const adminApp = getEnsuredApp();

/**
 * SuiteUtils Database Accessor
 */
export const suiteDb = getFirestore(adminApp, process.env.FIREBASE_DATABASE_ID || 'suiteutils-db-0');

/**
 * PromptTool Shared Database Accessor (for cross-app orchestration)
 */
export const registryDb = getFirestore(adminApp, 'prompttool-db-0');

/**
 * Persona Database Accessor (for Archetype & Principle management)
 */
export const personaDb = getFirestore(adminApp, 'persona-db-0');

/**
 * Auth Accessor
 */
export const adminAuth = getAuth(adminApp);
