/* eslint-disable */
import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const AWS_REGION = process.env.AWS_REGION || "eu-west-1";
const S3_BUCKET = process.env.S3_BUCKET || "";
const ROLE_ARN = process.env.S3_ASSUME_ROLE_ARN || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

async function getTemporaryCredentialsFromToken(idToken?: string) {
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

function makeS3ClientWithCreds(creds?: any) {
  if (creds) {
    return new S3Client({ region: AWS_REGION, credentials: creds });
  }
  return new S3Client({ region: AWS_REGION });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const auth = req.headers.get("authorization") || undefined;
    let idToken: string | undefined = undefined;
    if (auth) {
      const m = auth.match(/^Bearer\s+(.*)$/i);
      if (m) idToken = m[1];
    }

    let tempCreds = null;
    try { tempCreds = await getTemporaryCredentialsFromToken(idToken); } catch (e) { console.error('STS error', e); }

    const s3 = makeS3ClientWithCreds(tempCreds || undefined);
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const presigned = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });

    return NextResponse.json({ url: presigned }, { status: 200, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
  } catch (err: unknown) {
    console.error('presign-download failed', err);
    return NextResponse.json({ error: String(err) }, { status: 500, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
  }
}
