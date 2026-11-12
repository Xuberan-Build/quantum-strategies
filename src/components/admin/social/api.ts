/**
 * Browser-side client for the social publisher API (/api/admin/social/**).
 * Types mirror the API contract; PostWithTargets is defined here so the UI does not depend on engine files.
 */
import type {
  Format,
  Platform,
  PostStatus,
  SocialAccount,
  SocialMedia,
  SocialPost,
  SocialPostTarget,
  TargetOptions,
} from '@/lib/social/types';

export type TargetAccount = Pick<SocialAccount, 'id' | 'platform' | 'handle' | 'display_name' | 'avatar_url'>;

export type TargetWithAccount = SocialPostTarget & { account: TargetAccount | null };

export type PostWithTargets = SocialPost & { targets: TargetWithAccount[] };

export interface PlatformInfo {
  platform: Platform;
  label: string;
  formats: Format[];
  configured: boolean;
  requiredEnv: string[];
}

export interface AccountsResponse {
  accounts: SocialAccount[];
  platforms: PlatformInfo[];
}

export interface TargetInput {
  account_id: string;
  format: Format;
  caption_override?: string | null;
  options?: TargetOptions;
}

export interface PostInput {
  title?: string | null;
  caption: string;
  media: SocialMedia[];
  link?: string | null;
  first_comment?: string | null;
  tags?: string[];
  piece_id?: string | null;
  scheduled_at?: string | null;
  status: Extract<PostStatus, 'draft' | 'scheduled' | 'cancelled'>;
  targets: TargetInput[];
}

export interface PieceSummary {
  id: string;
  title: string | null;
  piece_type: string;
  status: string;
  scheduled_for: string | null;
  body: string | null;
}

export interface UploadUrlResponse {
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

/**
 * Error thrown for non-2xx responses. `errors` carries per-account validation messages keyed by account_id,
 * plus `_post` for problems with the post itself.
 */
export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors ?? {};
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof json.error === 'string' ? json.error : `Request failed (${res.status})`;
    const errors = json.errors && typeof json.errors === 'object' ? (json.errors as Record<string, string[]>) : undefined;
    throw new ApiError(msg, res.status, errors);
  }
  return json as T;
}

const BASE = '/api/admin/social';

export const socialApi = {
  accounts: () => request<AccountsResponse>(`${BASE}/accounts`),
  disconnect: (id: string) => request<{ ok: true }>(`${BASE}/accounts/${id}`, { method: 'DELETE' }),
  connectUrl: (platform: Platform, returnTo = '/admin/social/accounts') =>
    `${BASE}/oauth/${platform}/start?return_to=${encodeURIComponent(returnTo)}`,

  listPosts: (params: { from?: string; to?: string; status?: PostStatus[]; platform?: Platform | '' }) => {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.status?.length) q.set('status', params.status.join(','));
    if (params.platform) q.set('platform', params.platform);
    return request<{ posts: PostWithTargets[] }>(`${BASE}/posts?${q.toString()}`);
  },
  getPost: (id: string) => request<{ post: PostWithTargets }>(`${BASE}/posts/${id}`),
  createPost: (body: PostInput) => request<{ post: PostWithTargets }>(`${BASE}/posts`, { method: 'POST', body: JSON.stringify(body) }),
  updatePost: (id: string, body: Partial<PostInput>) =>
    request<{ post: PostWithTargets }>(`${BASE}/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePost: (id: string) => request<{ ok: true; deleted?: true; cancelled?: true }>(`${BASE}/posts/${id}`, { method: 'DELETE' }),
  publishNow: (id: string) => request<{ post: PostWithTargets }>(`${BASE}/posts/${id}/publish-now`, { method: 'POST' }),
  retryTarget: (id: string) => request<{ ok: true }>(`${BASE}/targets/${id}/retry`, { method: 'POST' }),

  uploadUrl: (body: { filename: string; contentType: string; sizeBytes: number }) =>
    request<UploadUrlResponse>(`${BASE}/media/upload-url`, { method: 'POST', body: JSON.stringify(body) }),

  /** `id` is passed so the route can return a single piece; results are still matched by id client-side. */
  pieces: (params: { q?: string; id?: string }) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.id) q.set('id', params.id);
    return request<{ pieces: PieceSummary[] }>(`${BASE}/pieces?${q.toString()}`);
  },
};

/** PUT a file to a Supabase signed upload URL with progress (0..1). */
export function putWithProgress(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}) ${xhr.responseText.slice(0, 200)}`));
    };
    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.send(file);
  });
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
