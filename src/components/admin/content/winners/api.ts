/** Browser-side client for /api/admin/content/winners and /api/admin/content/promotions/**. Type-only imports from the lib. */
import type { PieceType, Promotion, PromotionStatus } from '@/lib/content/any-to-any/types';
import type { PromotionWithPiece, WinnersResult } from '@/lib/content/any-to-any/winners';

export type { PieceType, Promotion, PromotionStatus, PromotionWithPiece, WinnersResult };
export type { Winner, ThinGroup, ChannelMedian } from '@/lib/content/any-to-any/winners';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(typeof json.error === 'string' ? json.error : `Request failed (${res.status})`, res.status);
  return json as T;
}

const BASE = '/api/admin/content';

export interface ExternalWinnerBody {
  url: string;
  platform: string;
  metric: string;
  value: number;
  channel_median?: number | null;
  title?: string;
  text?: string;
  format?: PieceType;
  source_format?: string;
}

export interface AcceptResponse {
  promotion: Promotion;
  piece: { id: string; title: string | null; piece_type: string };
  warnings: string[];
}

export const winnersApi = {
  winners: (days = 7) => request<WinnersResult>(`${BASE}/winners?days=${days}`),
  promotions: (status?: PromotionStatus) =>
    request<{ promotions: PromotionWithPiece[] }>(`${BASE}/promotions${status ? `?status=${status}` : ''}`),
  proposeFromTarget: (targetId: string, format: PieceType) =>
    request<{ promotion: Promotion; created: boolean }>(`${BASE}/promotions`, {
      method: 'POST',
      body: JSON.stringify({ target_id: targetId, proposed_format: format }),
    }),
  addExternal: (body: ExternalWinnerBody) =>
    request<{ promotion: Promotion; created: boolean }>(`${BASE}/promotions/external`, { method: 'POST', body: JSON.stringify(body) }),
  accept: (id: string) => request<AcceptResponse>(`${BASE}/promotions/${id}/accept`, { method: 'POST' }),
  dismiss: (id: string, notes?: string) =>
    request<{ promotion: Promotion }>(`${BASE}/promotions/${id}/dismiss`, { method: 'POST', body: JSON.stringify({ notes: notes ?? null }) }),
  markDone: (id: string) => request<{ promotion: Promotion }>(`${BASE}/promotions/${id}/done`, { method: 'POST' }),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Button text per longer form. */
export const MAKE_LABELS: Partial<Record<PieceType, string>> = {
  reddit_post: 'Make a Reddit post',
  blog: 'Make a spoke article',
  x_article: 'Make an X Article',
  youtube_long: 'Make a long video script',
  ig_carousel: 'Make a carousel',
  email: 'Make an email',
};

export const FORMAT_NAMES: Partial<Record<PieceType, string>> = {
  reddit_post: 'Reddit post',
  blog: 'Spoke article',
  x_article: 'X Article',
  youtube_long: 'Long video',
  ig_carousel: 'Carousel',
  email: 'Email',
  short: 'Vertical video',
  social_twitter: 'X post',
  social_ig: 'Instagram caption',
  reddit: 'Reddit answer',
};

export const makeLabel = (f: PieceType) => MAKE_LABELS[f] ?? `Make a ${FORMAT_NAMES[f] ?? f}`;
export const formatName = (f: string) => FORMAT_NAMES[f as PieceType] ?? f;

export const METRIC_NAMES: Record<string, string> = {
  replies: 'replies',
  likes: 'likes',
  saves: 'saves',
  shares: 'shares',
  views: 'views',
  upvotes_plus_comments: 'upvotes + comments',
};
export const metricName = (m: string | null | undefined) => (m ? METRIC_NAMES[m] ?? m.replace(/_/g, ' ') : '');

export const pieceHref = (id: string) => `/admin/studio/social-calendar/${id}`;
