import { accreditationDb } from '../firebase-admin';

/**
 * Sovereign Compliance Sentinel (PromptTool)
 * Monitors the clinical audit status of the suite to enforce real-time gating.
 */
export class ComplianceService {
    /**
     * Verifies if the suite is in a 'Sovereign Gated' state.
     * Checks critical policies (Online Safety Act) for technical enforcement drifts.
     */
    static async verifySovereignGate(): Promise<{ 
        gated: boolean; 
        status?: 'red' | 'amber' | 'green';
        message?: string; 
        breachedPolicySlug?: string;
    }> {
        try {
            // 1. Fetch ALL Policies from the central Accreditation Hub
            const snap = await accreditationDb.collection('policies').get();
            const policies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 2. SOVEREIGN_ENFORCEMENT: Search for RED breaches (Hard Lock)
            const breachedPolicy = (policies as any[]).find(p => p.status === 'red');
            if (breachedPolicy) {
                return { 
                    gated: true, 
                    status: 'red',
                    message: `Sovereign Lock Active: Critical breach detected in "${breachedPolicy.name}". AI generation is restricted to ensure regulatory compliance.`,
                    breachedPolicySlug: breachedPolicy.slug
                };
            }

            // 3. SOVEREIGN_ADVISORY: Search for AMBER drifts (Soft Warning)
            const driftedPolicy = (policies as any[]).find(p => p.status === 'amber');
            if (driftedPolicy) {
                return {
                    gated: false,
                    status: 'amber',
                    message: `Compliance Warning: technical drift detected in "${driftedPolicy.name}". Integrity restoration required.`,
                    breachedPolicySlug: driftedPolicy.slug
                };
            }

            return { gated: false, status: 'green' };

        } catch (error: any) {
            console.error('[ComplianceService] Sovereign Probe Failure:', error.message);
            // In case of system failure, we fail-open for AI tool to prevent total downtime,
            // but log the drift as a high-severity event.
            return { gated: false, status: 'green' };
        }
    }
}
