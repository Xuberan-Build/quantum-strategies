import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import {
  ASSET_KINDS,
  externalForm,
  isSourceForm,
  loadSource,
  MakeError,
  OFFERED_TARGETS,
  offeredTargets,
  targetLabel,
  type SourceForm,
} from '@/lib/content/any-to-any/make';
import type { AssetKind } from '@/lib/content/any-to-any/types';

/**
 * GET /api/admin/content/make/targets?form=<PieceType|article>
 *   or ?kind=<AssetKind>&id=<id> to resolve the form from the asset itself.
 * → { form, longer, same, shorter, labels }
 */
export async function GET(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const params = new URL(req.url).searchParams;
  let form: SourceForm | null = null;
  const formParam = params.get('form');
  if (formParam) {
    if (!isSourceForm(formParam)) return NextResponse.json({ error: `Unknown form: ${formParam}` }, { status: 400 });
    form = formParam;
  } else {
    const kind = params.get('kind') as AssetKind | null;
    const id = params.get('id');
    if (!kind || !id || !ASSET_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Pass form, or kind and id' }, { status: 400 });
    }
    if (kind === 'external') {
      form = externalForm(id).form;
    } else {
      try {
        form = (await loadSource(supabaseAdmin, { kind, id })).form;
      } catch (err) {
        if (err instanceof MakeError) return NextResponse.json({ error: err.message }, { status: err.status });
        throw err;
      }
    }
  }

  const labels = Object.fromEntries([...OFFERED_TARGETS, form].map((t) => [t, targetLabel(t)]));
  if (form === 'article') labels.article = 'Pillar article';
  return NextResponse.json({ form, ...offeredTargets(form), labels });
}
