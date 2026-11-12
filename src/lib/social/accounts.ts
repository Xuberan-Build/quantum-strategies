/**
 * Connected social accounts: load (with decrypted tokens), upsert after OAuth, refresh, disconnect.
 * The client is always passed in (supabaseAdmin in routes, a fake in tests). Token columns (*_enc) never leave this module.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken } from './crypto';
import { getAdapter } from './registry';
import type { AccountWithTokens, ConnectedAccountInput, SocialAccount } from './types';

export type Db = SupabaseClient;

/** Columns safe to return to the browser. */
export const PUBLIC_ACCOUNT_COLUMNS =
  'id, platform, external_id, handle, display_name, avatar_url, token_expires_at, scopes, meta, status, last_error, connected_at, updated_at';

const REFRESH_WINDOW_MS = 10 * 60 * 1000;
// Instagram long-lived tokens last 60 days and are refreshed directly (no refresh token), so refresh well ahead.
const PLATFORM_REFRESH_WINDOW_MS: Partial<Record<string, number>> = {
  instagram: 7 * 24 * 60 * 60 * 1000,
};

/** Strip token columns from a raw row (defence in depth: also use PUBLIC_ACCOUNT_COLUMNS in selects). */
export function toPublicAccount(row: Record<string, any>): SocialAccount {
  return {
    id: row.id,
    platform: row.platform,
    external_id: row.external_id,
    handle: row.handle ?? null,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    token_expires_at: row.token_expires_at ?? null,
    scopes: row.scopes ?? [],
    meta: row.meta ?? {},
    status: row.status,
    last_error: row.last_error ?? null,
    connected_at: row.connected_at,
    updated_at: row.updated_at,
  };
}

export async function loadAccountWithTokens(client: Db, id: string): Promise<AccountWithTokens | null> {
  const { data, error } = await client.from('social_accounts').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, any>;
  return {
    ...toPublicAccount(row),
    accessToken: decryptToken(row.access_token_enc),
    refreshToken: decryptToken(row.refresh_token_enc),
  };
}

export async function upsertConnectedAccounts(client: Db, inputs: ConnectedAccountInput[]): Promise<SocialAccount[]> {
  const out: SocialAccount[] = [];
  for (const input of inputs) {
    const row: Record<string, unknown> = {
      platform: input.platform,
      external_id: input.external_id,
      handle: input.handle ?? null,
      display_name: input.display_name ?? null,
      avatar_url: input.avatar_url ?? null,
      access_token_enc: encryptToken(input.accessToken),
      token_expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
      scopes: input.scopes ?? [],
      meta: input.meta ?? {},
      status: 'connected',
      last_error: null,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the refresh token when the provider returned one.
    if (input.refreshToken) row.refresh_token_enc = encryptToken(input.refreshToken);
    const { data, error } = await client
      .from('social_accounts')
      .upsert(row, { onConflict: 'platform,external_id' })
      .select(PUBLIC_ACCOUNT_COLUMNS)
      .single();
    if (error || !data) throw new Error(`Could not save ${input.platform} account: ${error?.message ?? 'no row'}`);
    out.push(toPublicAccount(data as Record<string, any>));
  }
  return out;
}

async function markExpired(client: Db, id: string, message: string) {
  await client
    .from('social_accounts')
    .update({ status: 'expired', last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
    .eq('id', id);
}

/**
 * Refresh the access token when it expires within 10 minutes (or already has).
 * On failure the account is marked 'expired' and an error is thrown.
 */
export async function ensureFreshToken(client: Db, account: AccountWithTokens, now: Date = new Date()): Promise<AccountWithTokens> {
  if (!account.token_expires_at) return account;
  const expiresMs = new Date(account.token_expires_at).getTime();
  const windowMs = PLATFORM_REFRESH_WINDOW_MS[account.platform] ?? REFRESH_WINDOW_MS;
  if (expiresMs - now.getTime() > windowMs) return account;

  const adapter = getAdapter(account.platform);
  if (!adapter.refreshToken) return account;

  try {
    const update = await adapter.refreshToken(account);
    const patch: Record<string, unknown> = {
      access_token_enc: encryptToken(update.accessToken),
      token_expires_at: update.expiresAt ? update.expiresAt.toISOString() : null,
      status: 'connected',
      last_error: null,
      updated_at: new Date().toISOString(),
    };
    if (update.refreshToken) patch.refresh_token_enc = encryptToken(update.refreshToken);
    const { error } = await client.from('social_accounts').update(patch).eq('id', account.id);
    if (error) throw new Error(error.message);
    return {
      ...account,
      accessToken: update.accessToken,
      refreshToken: update.refreshToken ?? account.refreshToken,
      token_expires_at: update.expiresAt ? update.expiresAt.toISOString() : null,
      status: 'connected',
    };
  } catch (err) {
    const message = `Token refresh failed: ${err instanceof Error ? err.message : String(err)}`;
    // Refreshed early and the current token still works: keep posting with it, retry the refresh next run.
    if (expiresMs - now.getTime() > REFRESH_WINDOW_MS) {
      await client.from('social_accounts').update({ last_error: message }).eq('id', account.id);
      return account;
    }
    await markExpired(client, account.id, message);
    throw new Error(message);
  }
}

export async function disconnectAccount(client: Db, id: string): Promise<void> {
  const { error } = await client
    .from('social_accounts')
    .update({
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
      status: 'disconnected',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
