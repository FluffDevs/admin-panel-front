import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyOptions } from 'jose';

// Environment variables required:
// COGNITO_ISSUER (ex: https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_xxx)
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET

const issuer = process.env.COGNITO_ISSUER;
if (!issuer) {
  // Allow the server to start but the route will reject if called.
  console.warn('COGNITO_ISSUER env is not set. JWT verification will fail.');
}

const jwksUri = issuer ? `${issuer}/.well-known/jwks.json` : undefined;
const jwks = jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : null;

async function verifyJwt(token: string) {
  if (!jwks) throw new Error('JWKS not configured');
  // verify without audience check to keep it generic; for production, set expected audience.
  const opts = { issuer } as unknown as JWTVerifyOptions;
  return await jwtVerify(token, jwks, opts);
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const token = auth.split(' ')[1];

    // verify token
    let payload: Record<string, unknown>;
    try {
      const verified = await verifyJwt(token);
      payload = verified.payload as Record<string, unknown>;
    } catch (err) {
      console.error('JWT verification failed', err);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

  // check role/group claim
  const groupsVal = payload['cognito:groups'] ?? payload['groups'];
  const groups: string[] = Array.isArray(groupsVal) ? (groupsVal.filter((g) => typeof g === 'string') as string[]) : [];
  const roleClaim = typeof payload['role'] === 'string' ? payload['role'] as string : (typeof payload['custom:role'] === 'string' ? payload['custom:role'] as string : undefined);

  // Allowed groups can be configured via ALLOWED_PROGRAMMATEUR_GROUPS (comma-separated). Defaults to 'programmateur'.
  const allowedEnv = process.env.ALLOWED_PROGRAMMATEUR_GROUPS ?? 'programmateur';
  const allowedGroups = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean);
  const isProgrammateur = allowedGroups.some((g) => groups.includes(g)) || roleClaim === 'programmateur';
    if (!isProgrammateur) {
      return NextResponse.json({ error: 'Forbidden: role programmateur required' }, { status: 403 });
    }

    const body = await req.json();
    const { key, operation, contentType } = body;
    if (!key || !operation) {
      return NextResponse.json({ error: 'Missing key or operation in body' }, { status: 400 });
    }

    // Basic validation of key prefix to avoid arbitrary writes
    const allowedPrefix = process.env.ALLOWED_S3_PREFIX ?? 'musics/';
    if (typeof key !== 'string' || key.includes('..') || key.startsWith('/')) {
      console.warn('Rejected invalid key:', key);
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    if (!key.startsWith(allowedPrefix)) {
      console.warn(`Rejected key not matching allowed prefix (${allowedPrefix}):`, key);
      return NextResponse.json({ error: 'Invalid key prefix' }, { status: 400 });
    }

    const region = process.env.AWS_REGION;
    const bucket = process.env.S3_BUCKET;
    if (!region || !bucket) {
      console.error('Missing S3 env vars');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const s3 = new S3Client({ region });

    if (operation === 'upload') {
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || 'application/octet-stream' });
      console.info(`Creating presigned upload URL for ${bucket}/${key}`);
      const url = await getSignedUrl(s3, command, { expiresIn: 900 });
      return NextResponse.json({ url, method: 'PUT', key });
    }

    if (operation === 'download') {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      console.info(`Creating presigned download URL for ${bucket}/${key}`);
      const url = await getSignedUrl(s3, command, { expiresIn: 900 });
      return NextResponse.json({ url, method: 'GET', key });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (err) {
    console.error('presign error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
