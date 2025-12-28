import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import type { S3ClientConfig, ListObjectsV2CommandOutput, _Object as S3Object } from "@aws-sdk/client-s3";

const AWS_REGION = process.env.AWS_REGION || "eu-west-1";
const S3_BUCKET = process.env.S3_BUCKET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

function makeS3Client() {
  const opts: S3ClientConfig = { region: AWS_REGION };
  // If AWS creds are present in env, the SDK will also pick them up automatically,
  // but we allow explicit env vars here for clarity.
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    // minimal credentials object
    opts.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } as unknown as S3ClientConfig["credentials"];
  }
  return new S3Client(opts);
}

function makeS3ClientWithCreds(creds?: { accessKeyId?: string; secretAccessKey?: string; sessionToken?: string }) {
  if (creds && creds.accessKeyId && creds.secretAccessKey) {
    return new S3Client({ region: AWS_REGION, credentials: creds as unknown as S3ClientConfig["credentials"] });
  }
  return makeS3Client();
}

async function getTemporaryCredentialsFromToken(idToken?: string) {
  const ROLE_ARN = process.env.S3_ASSUME_ROLE_ARN || "";
  if (!ROLE_ARN || !idToken) return null;
  const sts = new STSClient({ region: AWS_REGION });
  const cmd = new AssumeRoleWithWebIdentityCommand({
    RoleArn: ROLE_ARN,
    RoleSessionName: `web-${Date.now()}`,
    WebIdentityToken: idToken,
    DurationSeconds: 900,
  });
  const res = await sts.send(cmd);
  if (!res.Credentials) return null;
  return {
    accessKeyId: res.Credentials.AccessKeyId,
    secretAccessKey: res.Credentials.SecretAccessKey,
    sessionToken: res.Credentials.SessionToken,
  };
}

async function listAllObjects(s3: S3Client): Promise<S3Object[]> {
  const all: S3Object[] = [];
  let token: string | undefined = undefined;
  do {
    const cmd = new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken: token });
    const res = (await s3.send(cmd)) as ListObjectsV2CommandOutput;
    if (res.Contents) all.push(...(res.Contents as S3Object[]));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return all;
}

export async function GET(req: Request) {
  if (!S3_BUCKET) {
    return NextResponse.json({ error: "S3 bucket not configured (S3_BUCKET)" }, { status: 500 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = 50;

  // Try to use the connected user's credentials (via ID token) if available.
  // Read Authorization header from incoming request (Bearer <id_token>).
  let s3: S3Client;
  try {
    const auth = req.headers.get("authorization") || undefined;
    let idToken: string | undefined;
    if (auth) {
      const m = auth.match(/^Bearer\s+(.*)$/i);
      if (m) idToken = m[1];
    }
    const tempCreds = idToken ? await getTemporaryCredentialsFromToken(idToken) : null;
    s3 = makeS3ClientWithCreds(tempCreds || undefined);
  } catch (e) {
    console.error("S3 creds from token failed, falling back to server creds:", e);
    s3 = makeS3Client();
  }
  try {
    const contents = await listAllObjects(s3);

    // simple in-memory pagination
    const total = contents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const pageItems = contents.slice(start, start + pageSize);

    // CSV header: filename,id,size,updatedAt
    const lines = ["filename,id,size,updatedAt"];
    for (const obj of pageItems) {
      const key = obj.Key || "";
      const filename = key.split("/").pop() || key;
      const id = key;
      const size = obj.Size ?? 0;
      const updatedAt = obj.LastModified ? obj.LastModified.toISOString() : "";
      // wrap filename in quotes to be safe
      lines.push(`"${filename}","${id}","${size}","${updatedAt}"`);
    }

    const csv = lines.join("\n");
    const headers: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Next-Page": String(page < totalPages ? page + 1 : ""),
      "Total-Page": String(totalPages),
    };

    return new NextResponse(csv, { status: 200, headers });
  } catch (err: unknown) {
    console.error("S3 list error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
  }
}
