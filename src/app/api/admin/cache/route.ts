import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

async function streamToString(stream: Readable | ReadableStream | Uint8Array | null | undefined): Promise<string> {
  if (!stream) return '';

  // Web ReadableStream (has getReader)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  if (typeof (stream as ReadableStream)?.getReader === 'function') {
    // browser-like stream
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    const reader = (stream as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore-next-line
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value as Uint8Array);
    }
    const totalLength = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(out);
  }

  // Node.js Readable
  if (stream instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  // Uint8Array or Buffer-like
  if (stream instanceof Uint8Array) return new TextDecoder().decode(stream);
  if (typeof stream === 'string') return stream;
  return '';
}

function decodeJwtPayload(token?: string) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return json;
  } catch {
    return null;
  }
}

function isProgrammateurFromToken(token?: string) {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const groups = payload['cognito:groups'] ?? payload.groups ?? [];
  const allowedRaw = process.env.NEXT_PUBLIC_ALLOWED_PROGRAMMATEUR_GROUPS ?? process.env.ALLOWED_PROGRAMMATEUR_GROUPS ?? 'programmateur';
  const allowed = allowedRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(groups)) return groups.some((g: string) => allowed.includes(g));
  if (typeof groups === 'string') return allowed.includes(groups);
  return false;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '') || undefined;
    if (!token || !isProgrammateurFromToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const page = url.searchParams.get('page');
    const key = url.searchParams.get('key');

    // If `page` is provided, proxy the GET to the API /musics?page=N and return its CSV + pagination headers
    if (page !== null) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BRUNO_API_URL;
      if (!apiBase) return NextResponse.json({ error: 'API base not configured' }, { status: 500 });
      const apiUrl = `${apiBase.replace(/\/+$/, '')}/musics?page=${encodeURIComponent(page)}`;
      const headers: Record<string, string> = { Accept: 'text/csv' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(apiUrl, { method: 'GET', headers });
      const body = await res.text();
      const nextPage = res.headers.get('Next-Page');
      const totalPage = res.headers.get('Total-Page');
      const outHeaders: Record<string, string> = { 'Content-Type': 'text/csv' };
      if (nextPage) outHeaders['Next-Page'] = nextPage;
      if (totalPage) outHeaders['Total-Page'] = totalPage;
      return new NextResponse(body, { status: res.status, headers: outHeaders });
    }

    // Fallback: read directly from S3 when key provided
    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION;
    if (!bucket || !region) return NextResponse.json({ error: 'S3 not configured' }, { status: 500 });

    const client = new S3Client({ region });
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key || 'cache/musics/page_0.csv' });
    const res = await client.send(cmd);
    const body = await streamToString(res.Body as Readable | ReadableStream | Uint8Array | null | undefined);
    return new NextResponse(String(body), { status: 200, headers: { 'Content-Type': 'text/csv' } });
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '') || undefined;
    if (!token || !isProgrammateurFromToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const page = url.searchParams.get('page');
    const key = url.searchParams.get('key');
    const text = await req.text();

    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION;
    if (!bucket || !region) return NextResponse.json({ error: 'S3 not configured' }, { status: 500 });

    const client = new S3Client({ region });
    const targetKey = page !== null ? `cache/musics/page_${page}.csv` : (key || 'cache/musics/page_0.csv');
    const put = new PutObjectCommand({ Bucket: bucket, Key: targetKey, Body: Buffer.from(text, 'utf8'), ContentType: 'text/csv' });
    await client.send(put);
    return NextResponse.json({ ok: true, key: targetKey }, { status: 200 });
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
