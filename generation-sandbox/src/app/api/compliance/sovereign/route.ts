import { NextResponse } from 'next/server';
import { ComplianceService } from '@/lib/services/compliance-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/compliance/sovereign
 * Returns the current suite-wide sovereign lock status.
 * Used by the SovereignSentinel to enforce GATT (Gated Access & Technical Telemetry).
 */
export async function GET() {
    try {
        const { gated, status, message, breachedPolicySlug } = await ComplianceService.verifySovereignGate();
        
        return NextResponse.json({ 
            gated, 
            message: message || (gated ? 'Sovereign Compliance Breach Detected.' : 'Sovereign Status: Nominal'),
            status: status || (gated ? 'red' : 'green'),
            breachedPolicySlug,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('[SovereignAPI] Unexpected failure in PromptTool:', error.message);
        // Fail-closed for safety in PromptTool if the registry cannot be reached
        return NextResponse.json({
            success: false,
            gated: true,
            status: 'red',
            message: 'Internal Sovereign Failure: Access restricted for safety.'
        }, { status: 500 });
    }
}
