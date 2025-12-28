import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Server-side proxy to Bruno API to avoid CORS and attach server-side credentials if needed.
// Uses NEXT_PUBLIC_BRUNO_API_URL as fallback if BRUNO_API_URL not set.

const BRUNO_BASE = process.env.BRUNO_API_URL ?? process.env.NEXT_PUBLIC_BRUNO_API_URL;

export async function GET(req: NextRequest) {
  if (!BRUNO_BASE) {
    console.error('BRUNO_BASE missing. env BRUNO_API_URL / NEXT_PUBLIC_BRUNO_API_URL not set');
    return NextResponse.json({ error: 'BRUNO API base URL not configured' }, { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const qs = url.search;
  const target = `${BRUNO_BASE.replace(/\/$/, '')}/musics${qs}`;
  console.info('Proxying to Bruno:', target);

    // Forward Authorization header from client if present
    const auth = req.headers.get('authorization') ?? undefined;

    const headers: Record<string, string> = {};
    if (auth) headers['Authorization'] = auth;

    const res = await fetch(target, { method: 'GET', headers });

    const text = await res.text();
    // If client requested explicit fallback, return sample CSV for development
    const incomingUrl = new URL(req.url);
    const useFallback = incomingUrl.searchParams.get('fallback') === 'true';

    // If Bruno failed, allow an automatic developer fallback when not in production
    if (!res.ok) {
      console.error('Bruno API returned error', res.status, text);
      const isDev = (process.env.NODE_ENV || 'development') !== 'production';
      if (useFallback || isDev) {
        console.warn('Bruno API failed; returning developer fallback CSV (useFallback=' + useFallback + ', isDev=' + isDev + ')', res.status, text);
        const sample = [
          'id,title',
          'm1,Test track 1',
          'm2,Test track 2',
          'm3,Test track 3',
        ].join('\n');

        const headersObj: Record<string, string> = { 'Content-Type': 'text/csv', 'Next-Page': '1', 'Total-Page': '1' };
        return new NextResponse(sample, { status: 200, headers: headersObj });
      }

      // Otherwise surface the upstream error and indicate a fallback exists
      const headersObj: Record<string, string> = { 'X-Fallback-Available': 'true' };
      const ct = res.headers.get('content-type') || res.headers.get('Content-Type');
      if (ct) headersObj['Content-Type'] = ct;
      return new NextResponse(text, { status: res.status, headers: headersObj });
    }

    // copy headers NextResponse doesn't support all by default; at least forward pagination headers
  const nextPage = res.headers.get('Next-Page');
    const totalPage = res.headers.get('Total-Page');
    const headersObj: Record<string, string> = {};
    if (nextPage) headersObj['Next-Page'] = nextPage;
    if (totalPage) headersObj['Total-Page'] = totalPage;
    // Also forward content-type
    const ct = res.headers.get('content-type') || res.headers.get('Content-Type');
    if (ct) headersObj['Content-Type'] = ct;

    return new NextResponse(text, { status: res.status, headers: headersObj });
  } catch (err) {
    console.error('proxy /api/musics error', err);
    return NextResponse.json({ error: 'Proxy failed', detail: String(err) }, { status: 502 });
  }
}
