import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const filename = req.nextUrl.searchParams.get('filename') || `image-${Date.now()}.png`;

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fix for local development port discrepancies (Always force 127.0.0.1:3001 for internal fetches)
    let finalUrl = url.replace('localhost:3000', '127.0.0.1:3001').replace('localhost:3001', '127.0.0.1:3001');
    
    if (finalUrl !== url) {
        console.log(`[Download API] Fixed localhost mapping: ${url} -> ${finalUrl}`);
    }

    try {
        console.log(`[Download API] Proxying fetch for URL: ${finalUrl}`);
        const response = await fetch(finalUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const blob = await response.blob();
        const headers = new Headers();

        // Force download with Content-Disposition
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');

        return new NextResponse(blob, {
            status: 200,
            headers,
        });
    } catch (err: any) {
        console.error('[Download API] Error:', err);
        return NextResponse.json({ error: 'Failed to proxy download' }, { status: 500 });
    }
}
