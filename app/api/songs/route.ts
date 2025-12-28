import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const bucket = process.env.S3_BUCKET || process.env.BUCKET_NAME || process.env.AWS_S3_BUCKET;

const client = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        // assert string to satisfy AWS SDK typing
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      }
    : undefined,
});

export async function GET(req: Request) {
  if (!bucket) {
    return NextResponse.json({ error: "S3 bucket not configured (S3_BUCKET)" }, { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const prefix = url.searchParams.get("prefix") || "";

    const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
    const result = await client.send(command);

    const objects = (result.Contents || []).map((o) => ({
      key: o.Key,
      size: o.Size,
      lastModified: o.LastModified?.toISOString(),
    }));

    return NextResponse.json({ objects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
