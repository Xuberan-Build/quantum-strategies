import { buildSnapshot, type AccessRow, type ProgressSnapshot, type SnapshotInput } from '../progress';

export const NOW = new Date('2026-11-02T18:00:00Z'); // Monday 10am Pacific
export const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

export const ALL_OWNED: AccessRow[] = [
  'perception-rite-scan-1', 'perception-rite-scan-2', 'perception-rite-scan-3', 'perception-rite-scan-4', 'perception-rite-scan-5',
  'personal-alignment', 'business-alignment', 'brand-alignment',
  'declaration-rite-life-vision', 'declaration-rite-business-model', 'declaration-rite-strategic-path',
].map((product_slug) => ({ product_slug, completed_at: null }));

export function owned(completed: Record<string, string> = {}): AccessRow[] {
  return ALL_OWNED.map((r) => ({ ...r, completed_at: completed[r.product_slug] ?? null }));
}

export function snap(overrides: Partial<SnapshotInput> = {}, now = NOW): ProgressSnapshot {
  return buildSnapshot(
    {
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'pat@example.com', name: 'Pat Doe', discordUsername: 'pat', phone: null, createdAt: daysAgo(200) },
      access: owned(),
      lastSessionAt: null,
      prefs: { progress: true, newsletter: true },
      ...overrides,
    },
    now,
  );
}
