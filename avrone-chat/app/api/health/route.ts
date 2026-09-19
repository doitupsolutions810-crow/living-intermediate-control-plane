import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Deploy / uptime probe — no platform dependency. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'avrone-chat',
    ts: new Date().toISOString()
  });
}
