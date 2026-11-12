import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';

export const runtime = 'nodejs';

const MAX_BYTES = 1024 * 1024 * 1024;
const BUCKET = 'social-media';

function slugify(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : '';
  const clean = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const b = clean(base).slice(0, 60) || 'file';
  const e = clean(ext).slice(0, 8);
  return e ? `${b}.${e}` : b;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return jsonError('Body must be a JSON object', 400);
  const { filename, contentType, sizeBytes } = body;
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 255) return jsonError('filename is required', 400);
  if (typeof contentType !== 'string' || !/^(image|video)\/[\w.+-]+$/.test(contentType)) return jsonError('Only image/* and video/* files are allowed', 400);
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return jsonError('sizeBytes is required', 400);
  if (sizeBytes > MAX_BYTES) return jsonError('File is larger than 1 GB', 400);

  try {
    const d = new Date();
    const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}-${slugify(filename)}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? 'no signed url');
    const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl, publicUrl });
  } catch (err) {
    return serverError('upload url', err);
  }
}
