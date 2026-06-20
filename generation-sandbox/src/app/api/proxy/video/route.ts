// Video Proxy API Route
// Proxies video content from GCS (or any URL) through our server to bypass browser CORS restrictions.
// This allows the client-side canvas to draw video frames without tainting the canvas.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const url = request.nextUrl.searchParams.get('url');

        if (!url) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        // Only allow proxying GCS URLs to prevent open redirect abuse
        const allowedHosts = [
            'storage.googleapis.com',
            'storage.cloud.google.com',
        ];

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        if (!allowedHosts.includes(parsedUrl.hostname)) {
            return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
        }

        // Range request support (for video seeking)
        const rangeHeader = request.headers.get('range');
        const fetchHeaders: Record<string, string> = {};
        if (rangeHeader) {
            fetchHeaders['Range'] = rangeHeader;
        }

        const response = await fetch(url, { headers: fetchHeaders });

        if (!response.ok && response.status !== 206) {
            return NextResponse.json({ error: `Failed to fetch video: ${response.status}` }, { status: response.status });
        }

        // Forward the response with CORS headers for canvas access
        const headers = new Headers();
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET');
        headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');

        const contentLength = response.headers.get('Content-Length');
        if (contentLength) headers.set('Content-Length', contentLength);

        const contentRange = response.headers.get('Content-Range');
        if (contentRange) headers.set('Content-Range', contentRange);

        const acceptRanges = response.headers.get('Accept-Ranges');
        if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

        return new NextResponse(response.body, {
            status: response.status,
            headers,
        });

    } catch (error: any) {
        console.error('Video proxy error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
