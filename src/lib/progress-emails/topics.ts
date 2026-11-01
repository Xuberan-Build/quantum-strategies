/** Email topics a user can turn on or off. Pure and client-safe (no server imports). */
export type EmailTopic = 'progress' | 'newsletter';
export type EmailPreferences = Record<EmailTopic, boolean>;

export const EMAIL_TOPICS: readonly EmailTopic[] = ['progress', 'newsletter'];

export const DEFAULT_PREFERENCES: EmailPreferences = { progress: true, newsletter: true };

export const TOPIC_INFO: Record<EmailTopic, { label: string; description: string }> = {
  progress: { label: 'Progress emails', description: 'Where you are in the Rites, your next step, and a check-in if you get stuck.' },
  newsletter: { label: 'Newsletter', description: 'New articles and notes from Austin, every couple of weeks.' },
};

/** Valid topic toggles from a request body, or null when there are none. */
export function parsePreferenceChanges(body: unknown): Partial<EmailPreferences> | null {
  if (!body || typeof body !== 'object') return null;
  const changes: Partial<EmailPreferences> = {};
  for (const topic of EMAIL_TOPICS) {
    const v = (body as Record<string, unknown>)[topic];
    if (typeof v === 'boolean') changes[topic] = v;
  }
  return Object.keys(changes).length ? changes : null;
}
