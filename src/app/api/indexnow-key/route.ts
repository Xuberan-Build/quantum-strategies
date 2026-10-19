/**
 * IndexNow key file. next.config.ts rewrites /<INDEXNOW_KEY>.txt here, so
 * https://quantumstrategies.online/<key>.txt answers with the key as plain text (how IndexNow engines verify
 * the host). The key is public by design. 404 when INDEXNOW_KEY is not set.
 */
import { NextResponse } from 'next/server';
import { indexNowKey } from '@/lib/seo/indexnow';

export const dynamic = 'force-dynamic';

export function GET() {
  const key = indexNowKey();
  if (!key) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(key, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
