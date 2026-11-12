import QueueView, { type QueueTab } from '@/components/admin/social/QueueView';
import type { Platform } from '@/lib/social/types';

export const dynamic = 'force-dynamic';

const TABS: QueueTab[] = ['queue', 'calendar', 'drafts', 'published', 'failed'];
const PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok', 'x', 'threads'];

export default async function PublisherPage({ searchParams }: { searchParams: Promise<{ tab?: string; platform?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as QueueTab) ? (sp.tab as QueueTab) : 'queue';
  const platform = PLATFORMS.includes(sp.platform as Platform) ? (sp.platform as Platform) : '';
  return <QueueView initialTab={tab} initialPlatform={platform} />;
}
