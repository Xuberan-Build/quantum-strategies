/**
 * /api/admin/brain/map
 *
 * GET → TopicalMap { centralEntity, sourceContext, generatedAt, nodes }
 *   The whole pillar → section → topic → subtopic tree with scores, for the
 *   /admin/brain/map sunburst. Filtering happens on the client.
 *
 * Admin only (validateAdminApiRequest), checked before any data access. In development
 * only, a synthetic fixture is served when the data cannot be read, flagged
 * `fixture: true`. Production returns the error.
 */
import { NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getTopicalMap } from '@/lib/brain/topical-map';
import { fixtureAllowed, fixtureTopicalMap } from '@/lib/brain/topical-map-fixture';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  try {
    return NextResponse.json(await getTopicalMap());
  } catch (err) {
    console.error('[brain map] load failed:', err instanceof Error ? err.message : String(err));
    if (fixtureAllowed()) return NextResponse.json({ ...fixtureTopicalMap(), error: 'Topical map unavailable; showing the dev fixture.' });
    return NextResponse.json({ error: 'Could not load the topical map', nodes: [] }, { status: 500 });
  }
}
