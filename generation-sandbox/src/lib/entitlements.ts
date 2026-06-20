import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export type AppSuiteType = 'resources' | 'studio' | 'prompttool' | 'registry';

/**
 * ENTITLEMENT HELPER (PromptTool Version)
 * Checks access against the global Identity Store (database: 'prompttool-db-0').
 * Supports both 'studio' and 'prompttool' as equivalent keys for PromptTool access.
 */
export async function checkAppAccess(uid: string, app: AppSuiteType): Promise<boolean> {
    try {
        const apps = getApps();
        const firebaseApp = apps.length > 0 ? apps[0] : null;

        if (!firebaseApp) {
            console.error('[Entitlements] Firebase app not initialized');
            return false;
        }

        // Target the prompttool-db-0 database where user identity/subscription data resides
        const identityDb = getFirestore(firebaseApp, 'prompttool-db-0');
        const userDoc = await identityDb.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            console.warn(`[Entitlements] No user record found for ${uid} in prompttool-db-0`);
            return false;
        }
        
        const data = userDoc.data();
        console.log(`[Entitlements] Evaluating access for ${uid} on app ${app}. User role: ${data?.role}, roles: ${JSON.stringify(data?.roles)}`);

        // 1. Admins always have access
        if (data?.role === 'admin' || data?.role === 'su') return true;
        if (Array.isArray(data?.roles) && (data.roles.includes('admin') || data.roles.includes('su'))) return true;

        // 2. Read activeSuites from any of the three possible Firestore fields
        const subscriptionObj =
            data?.suiteSubscription ||
            data?.subscriptionMetadata ||
            (typeof data?.subscription === 'object' ? data?.subscription : null);

        const activeSuites: string[] = subscriptionObj?.activeSuites || [];
        console.log(`[Entitlements] Active suites for ${uid}: ${JSON.stringify(activeSuites)}`);

        // Direct match
        if (activeSuites.includes(app)) return true;

        // 3. studio ↔ prompttool are interchangeable for PromptTool access
        if (app === 'studio' && activeSuites.includes('prompttool')) return true;
        if (app === 'prompttool' && activeSuites.includes('studio')) return true;

        // 4. Legacy SubscriptionTier fallback
        const tier = typeof data?.subscription === 'string' ? data.subscription : null;
        if ((app === 'studio' || app === 'prompttool') &&
            (tier === 'pro' || tier === 'standard' || data?.subscription === 'pro')) {
            return true;
        }

        console.warn(`[Entitlements] Access DENIED for ${uid} on app ${app}`);
        return false;
    } catch (error) {
        console.error(`[Entitlements] Check failed for ${uid} on app ${app}:`, error);
        return false;
    }
}
