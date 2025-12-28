import { NextResponse } from "next/server";
// Import local S3 fallback handler so we can serve musics if Bruno upstream cannot access S3
import { GET as s3MusicsGET } from "../../s3/musics/route";

// Simple proxy that forwards any request under /api/bruno/* to BRUNO_BASE
const BRUNO_BASE = process.env.BRUNO_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const MOCK = (process.env.MOCK_BRUNO === "1" || (process.env.MOCK_BRUNO || "").toLowerCase() === "true");

async function handleRequest(req: Request) {
  if (!BRUNO_BASE) {
    return NextResponse.json({ error: "BRUNO API base not configured (BRUNO_API_BASE)" }, { status: 500 });
  }

  const reqUrl = new URL(req.url);
  // extract path after /api/bruno/
  const prefix = "/api/bruno/";
  let path = reqUrl.pathname;
  if (path.startsWith(prefix)) path = path.slice(prefix.length);
  // if empty path, forward to root
  const forwardPath = path || "";
  const url = BRUNO_BASE.replace(/\/$/, "") + (forwardPath ? "/" + forwardPath : "") + (reqUrl.search || "");

  const headers: Record<string, string> = {};
  for (const [k, v] of req.headers) {
    if (k.toLowerCase() === "host") continue;
    headers[k] = String(v);
  }

  // If a Bruno API key is provided in env, forward it as x-api-key.
  // Use a server-only env var BRUNO_API_KEY (do NOT put secret in NEXT_PUBLIC_*).
  const BRUNO_API_KEY = process.env.BRUNO_API_KEY || process.env.NEXT_PUBLIC_BRUNO_API_KEY || "";
  if (BRUNO_API_KEY) {
    headers["x-api-key"] = BRUNO_API_KEY;
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    const buf = await req.arrayBuffer();
    init.body = Buffer.from(buf);
  }

  if (MOCK) {
    // return a small CSV sample so the dashboard can work during dev
    const sample = `filename,id,size,updatedAt\n"demo-song.mp3","demo-1","123456","2025-12-01T12:00:00Z"\n"another.mp3","demo-2","234567","2025-12-02T12:00:00Z"\n`;
    const headers = new Headers({ "Content-Type": "text/csv", "Access-Control-Allow-Origin": CORS_ORIGIN });
    return new NextResponse(sample, { status: 200, headers });
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    console.error("Error fetching Bruno upstream:", err);
    return NextResponse.json({ error: String(err) }, { status: 502, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
  }

  // copy response headers and ensure a CORS header (helps during dev)
  const respHeaders = new Headers(res.headers as HeadersInit);
  respHeaders.set("Access-Control-Allow-Origin", CORS_ORIGIN);

  // if upstream returned an error, log body for debugging
  if (!res.ok) {
    const txt = await res.text().catch(() => "<body read error>");
    console.error("Bruno response", { url, status: res.status, body: txt });
    // If upstream cannot access S3, fall back to our own S3 handler for music listing/download
    try {
      if (txt && txt.includes("Unable to access page") && forwardPath.startsWith("musics") && req.method === "GET") {
        // delegate to local S3 musics handler (reads S3_BUCKET env)
        return await s3MusicsGET(req);
      }
    } catch (err) {
      console.error("S3 fallback error:", err);
    }
    // forward the upstream body with original status
    return new NextResponse(txt, { status: res.status, headers: respHeaders });
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, { status: res.status, headers: respHeaders });
}

export async function GET(req: Request) {
  return handleRequest(req);
}

export async function POST(req: Request) {
  return handleRequest(req);
}

export async function PATCH(req: Request) {
  return handleRequest(req);
}

export async function DELETE(req: Request) {
  return handleRequest(req);
}

export async function OPTIONS() {
  // simple preflight response
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN, "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" } });
}
