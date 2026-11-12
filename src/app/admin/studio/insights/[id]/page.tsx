import InsightDetail from '@/components/admin/content/insights/InsightDetail';

export const dynamic = 'force-dynamic';

export default async function InsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InsightDetail id={id} />;
}
