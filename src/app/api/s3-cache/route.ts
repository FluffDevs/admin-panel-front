import { NextResponse } from 'next/server';

// This endpoint was added for a quick debug flow but the user asked to cancel it.
// Keep a disabled stub to avoid 500s if referenced.
export async function GET() {
  return NextResponse.json({ error: 's3-cache endpoint disabled' }, { status: 410 });
}
