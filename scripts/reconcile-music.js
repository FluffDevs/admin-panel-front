#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * scripts/reconcile-music.js
 *
 * Usage examples:
 *   API_BASE and API_TOKEN can be provided via env or CLI args (--api-base, --api-token).
 *   node scripts/reconcile-music.js --dry-run
 *   node scripts/reconcile-music.js --delete-db --yes --api-token=XXX
 *
 * Options:
 *   --dry-run        (default) only shows differences
 *   --delete-db      delete DB entries present in API but missing in S3
 *   --delete-s3      delete S3 objects present in S3 but missing in API
 *   --yes            skip confirmation prompts (use with caution)
 *   --api-base=URL   override API base URL (default from env NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_BRUNO_API_URL)
 *   --api-token=TOK  API Bearer token for deletion requests
 *   --bucket=NAME    S3 bucket name (default from env S3_BUCKET)
 *   --prefix=PREFIX  S3 prefix to list (default '')
 */

const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const { argv, env } = process;

function parseArgs() {
  const args = { dryRun: true, deleteDb: false, deleteS3: false, yes: false };
  argv.slice(2).forEach((a) => {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--delete-db') { args.deleteDb = true; args.dryRun = false; }
    else if (a === '--delete-s3') { args.deleteS3 = true; args.dryRun = false; }
    else if (a === '--yes') args.yes = true;
    else if (a.startsWith('--api-base=')) args.apiBase = a.split('=')[1];
    else if (a.startsWith('--api-token=')) args.apiToken = a.split('=')[1];
    else if (a.startsWith('--bucket=')) args.bucket = a.split('=')[1];
    else if (a.startsWith('--prefix=')) args.prefix = a.split('=')[1];
  });
  return args;
}

function askConfirm(msg) {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdout.write(msg + ' (y/N): ');
    process.stdin.once('data', (data) => {
      const s = String(data).trim().toLowerCase();
      resolve(s === 'y' || s === 'yes');
    });
  });
}

async function fetchAllApiIds(apiBase, token) {
  const ids = new Set();
  let page = 0;
  let totalPages = null;
  const agent = new https.Agent({ keepAlive: true });
  while (true) {
    const url = `${apiBase}/musics?page=${page}`;
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'GET', headers, agent });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const json = await res.json();
      const data = json.data || [];
      data.forEach((it) => { if (it && it.id) ids.add(String(it.id)); });
      if (json.metadata && typeof json.metadata.page !== 'undefined' && typeof json.metadata.total_pages !== 'undefined') {
        totalPages = Number(json.metadata.total_pages);
      }
      if (totalPages !== null && page >= totalPages) break;
      page++;
      if (totalPages === null && data.length === 0) break;
    } else {
      // If API returns CSV, parse lines and collect first column as id
      const text = await res.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) break; // no data
      const headers = lines[0].split(',').map(h => h.trim());
      const idIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        ids.add(cols[idIndex] || '');
      }
      // Try to read pagination headers
      const next = res.headers.get('Next-Page');
      const total = res.headers.get('Total-Page');
      if (next !== null) { page = Number(next); }
      if (total !== null) { totalPages = Number(total); }
      if (totalPages !== null && page >= totalPages) break;
      page++;
    }
  }
  return ids;
}

async function listS3Ids(bucket, prefix) {
  const client = new S3Client({ region: process.env.AWS_REGION });
  const ids = new Set();
  let ContinuationToken = undefined;
  do {
    const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, ContinuationToken });
    const res = await client.send(cmd);
    const contents = res.Contents || [];
    for (const obj of contents) {
      if (!obj.Key) continue;
      const key = obj.Key;
      const base = key.split('/').pop() || key;
      const id = base.replace(/\.[^/.]+$/, '');
      ids.add(id);
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return ids;
}

async function main() {
  const args = parseArgs();
  const apiBase = args.apiBase || env.NEXT_PUBLIC_API_BASE_URL || env.NEXT_PUBLIC_BRUNO_API_URL;
  const apiToken = args.apiToken || env.API_TOKEN || env.BRUNO_API_TOKEN;
  const bucket = args.bucket || env.S3_BUCKET;
  const prefix = args.prefix || '';

  if (!apiBase) {
    console.error('API base URL not provided. Set NEXT_PUBLIC_API_BASE_URL or pass --api-base=...');
    process.exit(1);
  }
  if (!bucket) {
    console.error('S3 bucket not provided. Set S3_BUCKET or pass --bucket=...');
    process.exit(1);
  }

  console.log('Fetching API IDs from', apiBase);
  const apiIds = await fetchAllApiIds(apiBase, apiToken);
  console.log('Found', apiIds.size, 'IDs in API');

  console.log('Listing S3 objects in', bucket, 'prefix', prefix || '/');
  const s3Ids = await listS3Ids(bucket, prefix);
  console.log('Found', s3Ids.size, 'objects in S3');

  const apiOnly = [...apiIds].filter((id) => !s3Ids.has(id));
  const s3Only = [...s3Ids].filter((id) => !apiIds.has(id));

  console.log('API-only (in API but missing in S3):', apiOnly.length);
  if (apiOnly.length > 0) console.log(apiOnly.slice(0, 50));
  console.log('S3-only (in S3 but missing in API):', s3Only.length);
  if (s3Only.length > 0) console.log(s3Only.slice(0, 50));

  if (args.deleteDb && apiOnly.length > 0) {
    if (!apiToken) {
      console.error('API token required to delete DB entries. Provide --api-token or set API_TOKEN env.');
      process.exit(1);
    }
    if (!args.yes) {
      const ok = await askConfirm(`Delete ${apiOnly.length} DB entries from API?`);
      if (!ok) { console.log('Aborted'); process.exit(0); }
    }
    for (const id of apiOnly) {
      const url = `${apiBase}/musics/${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } });
      console.log('DELETE', id, '=>', res.status, res.statusText);
    }
  }

  if (args.deleteS3 && s3Only.length > 0) {
    if (!args.yes) {
      const ok = await askConfirm(`Delete ${s3Only.length} S3 objects from bucket ${bucket}?`);
      if (!ok) { console.log('Aborted'); process.exit(0); }
    }
    const client = new S3Client({ region: process.env.AWS_REGION });
    for (const id of s3Only) {
      // find the key matching this id (simple heuristic)
      // list again to find the key
      const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined });
      const res = await client.send(cmd);
      const contents = res.Contents || [];
      const match = contents.find((c) => c.Key && c.Key.endsWith(id) || c.Key && c.Key.endsWith(id + '.mp3'));
      if (match && match.Key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: match.Key }));
        console.log('Deleted S3 object', match.Key);
      } else {
        console.log('Could not find S3 object for id', id);
      }
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
