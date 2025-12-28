import { NextResponse } from "next/server";

const BRUNO_BASE = process.env.BRUNO_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

export async function GET() {
  if (!BRUNO_BASE) {
    return NextResponse.json({ error: "BRUNO API base not configured" }, { status: 500 });
  }

  const url = BRUNO_BASE.replace(/\/$/, "") + "/musics?page=1";
  try {
    const res = await fetch(url);
    const text = await res.text().catch(() => "");
    // log upstream for server-side debugging
    console.log("Bruno health check ->", { url, status: res.status, body: text });

    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
    };

    // try to parse JSON body if possible
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch (_) { /* not json */ }

    return NextResponse.json({ upstreamStatus: res.status, upstreamBody: parsed }, { status: res.status, headers });
  } catch (err: unknown) {
    console.error("Bruno health check error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
  }
}
import { NextResponse } from "next/server";

// health endpoint removed — return 404 to mimic original repo state where this file didn't exist
export async function GET() {
  return NextResponse.json({ message: "Not Found" }, { status: 404 });
}
