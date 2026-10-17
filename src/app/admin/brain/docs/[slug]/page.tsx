import { notFound } from 'next/navigation';
import { DocReader } from '@/components/admin/brain/DocReader';
import { splitDoc } from '@/lib/brain/doc-sections';
import { getBrainDoc, loadFeedback } from '@/lib/brain/load';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}

export default async function BrainDocPage({ params, searchParams }: PageProps) {
  const [{ slug: rawSlug }, query] = await Promise.all([params, searchParams]);
  const slug = decodeURIComponent(rawSlug);
  const doc = await getBrainDoc(slug, typeof query.v === 'string' ? query.v : undefined);
  if (!doc) notFound();

  const feedback = await loadFeedback('doc', slug);
  return (
    <DocReader
      entry={doc.entry}
      hash={doc.hash}
      blocks={splitDoc(doc.markdown)}
      feedback={feedback.rows}
      feedbackError={feedback.error}
    />
  );
}
