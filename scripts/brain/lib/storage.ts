/**
 * Service-role Storage helpers for the brain publish scripts. Writes only to the private
 * `brain` bucket; refuses to write if the bucket is public. Never deletes anything.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BRAIN_BUCKET } from '../../../src/lib/brain/snapshot';

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function ensurePrivateBucket(sb: SupabaseClient): Promise<void> {
  const { data: bucket } = await sb.storage.getBucket(BRAIN_BUCKET);
  if (!bucket) {
    const { error } = await sb.storage.createBucket(BRAIN_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`createBucket: ${error.message}`);
    console.log(`created private bucket "${BRAIN_BUCKET}"`);
  } else if (bucket.public) {
    throw new Error(`bucket "${BRAIN_BUCKET}" is PUBLIC — refusing to upload brain content. Make it private first.`);
  }
}

/** Returns null when the object does not exist. */
export async function downloadText(sb: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await sb.storage.from(BRAIN_BUCKET).download(path);
  if (error || !data) return null;
  return data.text();
}

/**
 * Upload text. With upsert=false an existing object is left untouched (used for
 * immutable versions) and the call reports `existed`.
 */
export async function uploadText(
  sb: SupabaseClient,
  path: string,
  body: string,
  contentType: string,
  upsert = true,
): Promise<'uploaded' | 'existed'> {
  const { error } = await sb.storage
    .from(BRAIN_BUCKET)
    .upload(path, new Blob([body], { type: contentType }), { upsert, contentType, cacheControl: '60' });
  if (error) {
    if (!upsert && /exists|duplicate/i.test(error.message)) return 'existed';
    throw new Error(`upload ${path}: ${error.message}`);
  }
  return 'uploaded';
}
