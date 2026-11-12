/** Small helpers shared by the /api/admin/social routes. */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest, type AdminUser } from '@/lib/admin/auth';
import { ADAPTERS } from './registry';
import type { Platform } from './types';

export async function requireAdmin(): Promise<{ admin: AdminUser; response?: undefined } | { admin?: undefined; response: NextResponse }> {
  const { admin, error } = await validateAdminApiRequest();
  if (admin) return { admin };
  const status = error === 'Not authenticated' ? 401 : error === 'Internal error' ? 500 : 403;
  return { response: NextResponse.json({ error: error ?? 'Unauthorized' }, { status }) };
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function serverError(scope: string, err: unknown) {
  console.error(`[social] ${scope}:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export function parsePlatform(value: string): Platform | null {
  return value in ADAPTERS ? (value as Platform) : null;
}

/** Only same-site relative paths may be used as post-OAuth destinations. */
export function safeReturnTo(value: string | null | undefined, fallback = '/admin/social/accounts'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}

export function siteUrl(req: NextRequest, path: string, params: Record<string, string> = {}): URL {
  const base = (process.env.SOCIAL_OAUTH_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '');
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export async function readJson(req: NextRequest): Promise<Record<string, any> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
