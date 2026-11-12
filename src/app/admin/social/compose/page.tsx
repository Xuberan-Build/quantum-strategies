import Composer from '@/components/admin/social/Composer';

export const dynamic = 'force-dynamic';

export default async function ComposePage({ searchParams }: { searchParams: Promise<{ post?: string; piece?: string; at?: string }> }) {
  const sp = await searchParams;
  // key: remount when switching between posts so state never leaks across edits
  return <Composer key={`${sp.post ?? ''}|${sp.piece ?? ''}|${sp.at ?? ''}`} postId={sp.post} pieceId={sp.piece} at={sp.at} />;
}
