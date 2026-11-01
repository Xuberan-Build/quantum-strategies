/**
 * Links in progress emails: one-click opt-out per topic, and the next step.
 * Opt-out tokens never expire and are signed for their own purpose.
 */
import { isUuid } from '@/lib/read/email-links';
import { decodeSignedToken, encodeSignedToken } from '@/lib/email/signed-token';
import { EMAIL_TOPICS, type EmailTopic } from './topics';

const PURPOSE = 'email-prefs';

export interface OptOutPayload {
  userId: string;
  topic: EmailTopic;
}

export function signOptOut(p: OptOutPayload): string {
  return encodeSignedToken({ u: p.userId, t: p.topic }, PURPOSE);
}

export function verifyOptOut(token: unknown): OptOutPayload | null {
  const wire = decodeSignedToken(token, PURPOSE) as { u?: unknown; t?: unknown } | null;
  if (!wire || !isUuid(wire.u) || !EMAIL_TOPICS.includes(wire.t as EmailTopic)) return null;
  return { userId: wire.u, topic: wire.t as EmailTopic };
}

/** Page in the email footer. It confirms with a POST so link scanners can't opt anyone out. */
export function optOutPageUrl(appUrl: string, p: OptOutPayload): string {
  const u = new URL('/email/preferences', appUrl);
  u.searchParams.set('t', signOptOut(p));
  return u.toString();
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header. */
export function optOutOneClickUrl(appUrl: string, p: OptOutPayload): string {
  const u = new URL('/api/email/preferences', appUrl);
  u.searchParams.set('t', signOptOut(p));
  return u.toString();
}

export function settingsUrl(appUrl: string): string {
  return new URL('/dashboard/profile?tab=settings', appUrl).toString();
}

export function nextStepUrl(appUrl: string, slug: string, campaign: string): string {
  const u = new URL(`/products/${slug}/experience`, appUrl);
  u.searchParams.set('utm_source', 'email');
  u.searchParams.set('utm_medium', 'progress');
  u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}

export function adminUserUrl(appUrl: string, userId: string): string {
  return new URL(`/admin/users/${userId}`, appUrl).toString();
}
