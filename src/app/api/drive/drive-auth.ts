import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export function requireDriveAuth(request: NextRequest) {
  const expected = process.env.DRIVE_API_TOKEN;
  if (!expected) {
    console.error('[drive-auth] DRIVE_API_TOKEN is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const alt = request.headers.get('x-drive-token') || '';

  const expectedBuf = Buffer.from(expected);
  const bearerMatch = bearer.length === expected.length &&
    timingSafeEqual(Buffer.from(bearer), expectedBuf);
  const altMatch = alt.length === expected.length &&
    timingSafeEqual(Buffer.from(alt), expectedBuf);

  if (bearerMatch || altMatch) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
