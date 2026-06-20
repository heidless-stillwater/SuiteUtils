import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

let cachedQuota: { limit: number, status: string, timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
    // Check cache
    if (cachedQuota && (Date.now() - cachedQuota.timestamp < CACHE_TTL)) {
        return NextResponse.json({ 
            limit: cachedQuota.limit,
            unit: 'req/min',
            status: cachedQuota.status,
            cached: true
        }, { headers: CORS_HEADERS });
    }
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
        }

        const token = authHeader.substring(7);
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (!decodedToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
        }

        // --- FETCH QUOTA STATUS ---
        // Using gcloud-style discovery logic via child_process to avoid complex SDK setup for this one-off check
        const { execSync } = require('child_process');
        
        let limit = "1";
        try {
            // Check us-central1 first
            const cmd = `gcloud alpha quotas info list --project=heidless-apps-2 --service=aiplatform.googleapis.com --filter="quotaId:OnlinePredictionRequestsPerMinutePerProjectPerRegionPerBaseModel AND dimensionsInfos.dimensions.base_model:imagen-3.0-generate AND dimensionsInfos.dimensions.region:us-central1" --format="value(dimensionsInfos[0].applicableConfigs[0].effectiveLimit)"`;
            const result = execSync(cmd, { encoding: 'utf8' }).trim();
            if (result) limit = result;
        } catch (err) {
            console.error('[QuotaAPI] Failed to fetch quota via gcloud:', err);
        }

        cachedQuota = {
            limit: parseInt(limit),
            status: parseInt(limit) > 1 ? 'Approved' : 'Restricted',
            timestamp: Date.now()
        };

        return NextResponse.json({ 
            limit: parseInt(limit),
            unit: 'req/min',
            status: parseInt(limit) > 1 ? 'Approved' : 'Restricted'
        }, { headers: CORS_HEADERS });

    } catch (error: any) {
        console.error('Quota Status API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
    }
}
