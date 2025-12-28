import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import type { S3ClientConfig, GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const AWS_REGION = process.env.AWS_REGION || "eu-west-1";
const S3_BUCKET = process.env.S3_BUCKET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

function makeS3Client() {
  const opts: S3ClientConfig = { region: AWS_REGION };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    opts.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } as unknown as S3ClientConfig["credentials"];
  }
  return new S3Client(opts);
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!S3_BUCKET) {
    return NextResponse.json({ error: "S3 bucket not configured (S3_BUCKET)" }, { status: 500 });
  }

  const id = params.id;
  const url = new URL(req.url);
  const base64 = (url.searchParams.get("base64") || "false").toLowerCase() === "true";
  const includeMetadata = (url.searchParams.get("include-metadata") || "false").toLowerCase() === "true";

  const s3 = makeS3Client();
  try {
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: id });
    const res = (await s3.send(cmd)) as GetObjectCommandOutput;

    if (!res.Body) {
      return NextResponse.json({ error: "S3 object has no body" }, { status: 404, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
    }

    // handle possible Body shapes (Readable stream, Uint8Array, Blob)
    let buffer: Buffer;
    const bodyAny = res.Body as unknown;
    // If Node Readable (has pipe function)
    if (typeof (bodyAny as Readable).pipe === "function") {
      buffer = await streamToBuffer(bodyAny as Readable);
    } else if (bodyAny instanceof Uint8Array) {
      buffer = Buffer.from(bodyAny as Uint8Array);
    } else if (typeof (bodyAny as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
      // e.g. Blob-like
      const ab = await (bodyAny as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
      buffer = Buffer.from(new Uint8Array(ab));
    } else {
      // fallback
      buffer = Buffer.from(String(bodyAny));
    }

    const headers: Record<string, string> = { "Access-Control-Allow-Origin": CORS_ORIGIN };
    if (includeMetadata) {
      headers["X-Object-Metadata"] = JSON.stringify({
        ContentType: res.ContentType,
        ContentLength: res.ContentLength,
        LastModified: res.LastModified,
      });
    }

    if (base64) {
      return new NextResponse(buffer.toString("base64"), { status: 200, headers: { ...headers, "Content-Type": "text/plain" } });
    }

  const bodyUint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return new NextResponse(bodyUint8 as unknown as BodyInit, { status: 200, headers: { ...headers, "Content-Type": res.ContentType || "application/octet-stream" } });
  } catch (err: unknown) {
    console.error("S3 getObject error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
  }
}
