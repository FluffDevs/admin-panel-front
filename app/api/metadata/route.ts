import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // In a real app, persist metadata to a DB or object tags on S3.
    // Here we mock success and echo back the payload.
    return NextResponse.json({ ok: true, saved: body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
