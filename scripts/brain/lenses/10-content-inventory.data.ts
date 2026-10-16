/**
 * Lens 10 — content inventory: deterministic, READ-ONLY aggregate counts.
 *
 * Prints one JSON document to stdout describing every content asset the app knows about
 * (database content tables, the knowledge corpus, product definitions, email campaigns,
 * the Drive file index, and content files in this repo). The weekly content-inventory
 * lens reads this JSON and updates the private inventory note.
 *
 * Guarantees:
 *   - SELECT only. No inserts, updates, deletes, RPCs or migrations.
 *   - No row bodies, no PII, no row IDs, no Stripe/Drive identifiers. Asset *titles* and
 *     slugs are emitted (they name content, not people) so duplicates and gaps are visible.
 *   - Deterministic: keys and lists are sorted; only `generated_at` varies between runs on
 *     unchanged data.
 *
 * Run from the repo root:
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/lenses/10-content-inventory.data.ts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

type Row = Record<string, unknown>;
type Counts = Record<string, number>;

const PAGE = 1000;
const REPO_ROOT = process.cwd();

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ---------- helpers ----------

function sortObj<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

function countBy(rows: Row[], fn: (r: Row) => unknown): Counts {
  const out: Counts = {};
  for (const r of rows) {
    const v = fn(r);
    const k = v === null || v === undefined || v === '' ? '(none)' : String(v);
    out[k] = (out[k] ?? 0) + 1;
  }
  return sortObj(out);
}

function topN(counts: Counts, n: number): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, n);
}

function words(v: unknown): number {
  if (typeof v !== 'string') return 0;
  const t = v.replace(/<[^>]+>/g, ' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function norm(title: unknown): string {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function duplicates(rows: Row[], field = 'title'): Array<{ title: string; count: number }> {
  const groups = new Map<string, { title: string; count: number }>();
  for (const r of rows) {
    const k = norm(r[field]);
    if (!k) continue;
    const g = groups.get(k);
    if (g) g.count += 1;
    else groups.set(k, { title: String(r[field]), count: 1 });
  }
  return [...groups.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

function maxDate(rows: Row[], field: string): string | null {
  let best: string | null = null;
  for (const r of rows) {
    const v = r[field];
    if (typeof v === 'string' && (!best || v > best)) best = v;
  }
  return best;
}

function since(rows: Row[], field: string, days: number): number {
  const cutoff = Date.now() - days * 86_400_000;
  return rows.filter((r) => typeof r[field] === 'string' && Date.parse(r[field] as string) >= cutoff)
    .length;
}

/** Fetch selected columns of every row, paginated. Returns null if the table is unavailable. */
async function fetchAll(sb: SupabaseClient, table: string, cols: string): Promise<Row[] | null> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return from === 0 ? null : out;
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function exactCount(
  sb: SupabaseClient,
  table: string,
  filter?: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<number | null> {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error || count === null) return null;
  return count;
}

// ---------- database sections ----------

const TABLES = [
  'knowledge_chunks', 'knowledge_sources', 'corpus_ingestion_queue',
  'content_pillars', 'content_topics', 'content_angles', 'content_sections', 'content_pieces',
  'content_corpus_links', 'content_agent_runs', 'content_jobs', 'content_posts', 'content_index',
  'product_definitions', 'product_steps', 'product_landing_pages', 'product_suggestions',
  'prompts', 'question_pool', 'campaigns', 'campaign_steps', 'email_sequences',
  'course_definitions', 'course_modules', 'course_submodules',
  'workshops', 'workshop_modules', 'workshop_slides', 'lead_magnets',
];

async function tableCounts(sb: SupabaseClient) {
  const out: Record<string, number | null> = {};
  for (const t of TABLES) out[t] = await exactCount(sb, t);
  return sortObj(out);
}

async function corpus(sb: SupabaseClient, names: Set<string>) {
  const rows = await fetchAll(sb, 'knowledge_chunks', 'id,tradition,text_name,content_type,priority,created_at');
  if (!rows) return { available: false };
  for (const r of rows) names.add(String(r.text_name));
  const byText = countBy(rows, (r) => r.text_name);
  const missingEmbedding = await exactCount(sb, 'knowledge_chunks', (q) => q.is('embedding', null));
  return {
    available: true,
    total: rows.length,
    missing_embedding: missingEmbedding,
    distinct_text_names: Object.keys(byText).length,
    by_tradition: countBy(rows, (r) => r.tradition),
    by_content_type: countBy(rows, (r) => r.content_type),
    by_priority: countBy(rows, (r) => r.priority),
    tradition_x_content_type: sortObj(
      Object.fromEntries(
        Object.entries(
          rows.reduce<Record<string, Row[]>>((acc, r) => {
            const k = String(r.tradition ?? '(none)');
            (acc[k] ??= []).push(r);
            return acc;
          }, {}),
        ).map(([k, rs]) => [k, countBy(rs, (r) => r.content_type)]),
      ),
    ),
    top_text_names: topN(byText, 40),
    newest_chunk_at: maxDate(rows, 'created_at'),
    added_last_7d: since(rows, 'created_at', 7),
    added_last_30d: since(rows, 'created_at', 30),
  };
}

async function sources(sb: SupabaseClient, chunkTextNames: Set<string>) {
  const rows = await fetchAll(sb, 'knowledge_sources', 'id,tradition,text_name,format,priority,chunk_count,status,ingested_at');
  if (!rows) return { available: false };
  const sourceNames = new Set(rows.map((r) => String(r.text_name)));
  return {
    available: true,
    total: rows.length,
    by_status: countBy(rows, (r) => r.status),
    by_tradition: countBy(rows, (r) => r.tradition),
    by_format: countBy(rows, (r) => r.format),
    by_priority: countBy(rows, (r) => r.priority),
    declared_chunk_count_sum: rows.reduce((s, r) => s + (Number(r.chunk_count) || 0), 0),
    sources_with_zero_declared_chunks: rows
      .filter((r) => !Number(r.chunk_count))
      .map((r) => String(r.text_name))
      .sort(),
    sources_not_in_corpus: [...sourceNames].filter((n) => !chunkTextNames.has(n)).sort(),
    corpus_text_names_without_source: [...chunkTextNames].filter((n) => !sourceNames.has(n)).sort(),
    duplicate_text_names: duplicates(rows, 'text_name'),
  };
}

async function contentTree(sb: SupabaseClient) {
  const pillars = (await fetchAll(sb, 'content_pillars', 'id,title,slug,created_at')) ?? [];
  const topics = (await fetchAll(sb, 'content_topics', 'id,pillar_id,title,created_at')) ?? [];
  const angles =
    (await fetchAll(
      sb,
      'content_angles',
      'id,topic_id,title,format,audience,goal,tone,status,tradition_filter,lead_magnet_type,distribute_formats,created_at,updated_at',
    )) ?? [];
  const sections = (await fetchAll(sb, 'content_sections', 'id,angle_id,status,body,created_at')) ?? [];
  const pieces = await fetchAll(sb, 'content_pieces', '*');
  const links = (await fetchAll(sb, 'content_corpus_links', 'id,angle_id,curated,similarity')) ?? [];
  const runs = await fetchAll(sb, 'content_agent_runs', 'id,content_angle_id,agent_type,status,human_approved,run_at');
  const jobs = await fetchAll(sb, 'content_jobs', 'id,angle_id,job_type,status,created_at');

  const pillarTitle = new Map(pillars.map((p) => [p.id, String(p.title)]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const anglesByTopic = countBy(angles, (a) => a.topic_id);
  const topicsByPillar = countBy(topics, (t) => t.pillar_id);
  const anglesByPillar: Counts = {};
  for (const a of angles) {
    const t = topicById.get(a.topic_id);
    const k = t ? pillarTitle.get(t.pillar_id) ?? '(unknown pillar)' : '(no topic)';
    anglesByPillar[k] = (anglesByPillar[k] ?? 0) + 1;
  }
  const linkedAngles = new Set(links.map((l) => l.angle_id));
  const sectionAngles = new Set(sections.map((s) => s.angle_id));
  const runAngles = new Set((runs ?? []).map((r) => r.content_angle_id));
  const pieceWords = (pieces ?? []).map((p) => words(p.body));
  const sectionWords = sections.map((s) => words(s.body));

  return {
    pillars: pillars
      .map((p) => ({
        title: String(p.title),
        slug: p.slug ?? null,
        topics: topicsByPillar[String(p.id)] ?? 0,
        angles: anglesByPillar[String(p.title)] ?? 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    topics: {
      total: topics.length,
      duplicate_titles: duplicates(topics),
      without_angles: topics
        .filter((t) => !anglesByTopic[String(t.id)])
        .map((t) => String(t.title))
        .sort(),
      list: topics
        .map((t) => ({
          title: String(t.title),
          pillar: pillarTitle.get(t.pillar_id) ?? '(none)',
          angles: anglesByTopic[String(t.id)] ?? 0,
        }))
        .sort((a, b) => a.pillar.localeCompare(b.pillar) || a.title.localeCompare(b.title)),
    },
    angles: {
      total: angles.length,
      by_status: countBy(angles, (a) => a.status),
      by_format: countBy(angles, (a) => a.format),
      by_tone: countBy(angles, (a) => a.tone),
      by_lead_magnet_type: countBy(angles, (a) => a.lead_magnet_type),
      by_tradition_filter: countBy(angles, (a) => a.tradition_filter),
      by_audience_top: topN(countBy(angles, (a) => a.audience), 10),
      by_pillar: sortObj(anglesByPillar),
      without_topic: angles.filter((a) => !a.topic_id || !topicById.has(a.topic_id)).map((a) => String(a.title)).sort(),
      duplicate_titles: duplicates(angles),
      with_distribute_formats: angles.filter((a) => Array.isArray(a.distribute_formats) && (a.distribute_formats as unknown[]).length).length,
      with_corpus_links: angles.filter((a) => linkedAngles.has(a.id)).length,
      with_sections: angles.filter((a) => sectionAngles.has(a.id)).length,
      with_agent_runs: angles.filter((a) => runAngles.has(a.id)).length,
      created_last_7d: since(angles, 'created_at', 7),
      updated_last_7d: since(angles, 'updated_at', 7),
      newest_created_at: maxDate(angles, 'created_at'),
      titles_with_status: angles
        .map((a) => ({ title: String(a.title), status: a.status ?? null, format: a.format ?? null }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    },
    sections: {
      total: sections.length,
      by_status: countBy(sections, (s) => s.status),
      with_body: sectionWords.filter((w) => w > 0).length,
      body_words_total: sectionWords.reduce((s, w) => s + w, 0),
      distinct_angles: sectionAngles.size,
    },
    pieces: pieces
      ? {
          total: pieces.length,
          by_type: countBy(pieces, (p) => p.piece_type),
          by_status: countBy(pieces, (p) => p.status),
          body_words_total: pieceWords.reduce((s, w) => s + w, 0),
          body_words_median: median(pieceWords),
        }
      : { available: false },
    corpus_links: {
      total: links.length,
      curated: links.filter((l) => l.curated === true).length,
      distinct_angles: linkedAngles.size,
    },
    agent_runs: runs
      ? {
          total: runs.length,
          by_agent_type: countBy(runs, (r) => r.agent_type),
          by_status: countBy(runs, (r) => r.status),
          by_human_approved: countBy(runs, (r) => r.human_approved),
          last_run_at: maxDate(runs, 'run_at'),
          runs_last_7d: since(runs, 'run_at', 7),
        }
      : { available: false },
    jobs: jobs
      ? {
          total: jobs.length,
          by_job_type: countBy(jobs, (j) => j.job_type),
          by_status: countBy(jobs, (j) => j.status),
          last_created_at: maxDate(jobs, 'created_at'),
        }
      : { available: false },
  };
}

async function posts(sb: SupabaseClient) {
  const rows = await fetchAll(sb, 'content_posts', 'id,slug,type,title,body,tags,is_published,published_at,pillar_id,topic_id,piece_id,created_at,updated_at');
  if (!rows) return { available: false };
  const w = rows.map((r) => words(r.body));
  return {
    available: true,
    total: rows.length,
    by_type: countBy(rows, (r) => r.type),
    by_published: countBy(rows, (r) => r.is_published),
    type_x_published: sortObj(
      Object.fromEntries(
        [...new Set(rows.map((r) => String(r.type)))].map((t) => [
          t,
          countBy(rows.filter((r) => String(r.type) === t), (r) => (r.is_published ? 'published' : 'unpublished')),
        ]),
      ),
    ),
    body_words_total: w.reduce((s, x) => s + x, 0),
    body_words_median: median(w),
    empty_body: w.filter((x) => x === 0).length,
    under_300_words: w.filter((x) => x > 0 && x < 300).length,
    with_pillar: rows.filter((r) => r.pillar_id).length,
    with_topic: rows.filter((r) => r.topic_id).length,
    from_studio_piece: rows.filter((r) => r.piece_id).length,
    tag_counts_top: topN(
      rows.reduce<Counts>((acc, r) => {
        for (const t of (r.tags as string[] | null) ?? []) acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {}),
      20,
    ),
    duplicate_titles: duplicates(rows),
    published_last_30d: since(rows.filter((r) => r.is_published), 'published_at', 30),
    updated_last_7d: since(rows, 'updated_at', 7),
    list: rows
      .map((r, i) => ({
        slug: String(r.slug),
        title: String(r.title),
        type: r.type ?? null,
        published: r.is_published === true,
        words: w[i],
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

function stepCount(steps: unknown): number | null {
  if (Array.isArray(steps)) return steps.length;
  if (typeof steps === 'string') {
    try {
      const p = JSON.parse(steps);
      return Array.isArray(p) ? p.length : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function products(sb: SupabaseClient) {
  const rows = await fetchAll(
    sb,
    'product_definitions',
    'id,product_slug,name,price,steps,total_steps,is_active,is_purchasable,product_group,plg_stage,display_order,system_prompt,final_deliverable_prompt,stripe_price_id,pillar_id,updated_at',
  );
  if (!rows) return { available: false };
  const landing = (await fetchAll(sb, 'product_landing_pages', 'id,product_id,status')) ?? [];
  const landingBy = new Map(landing.map((l) => [l.product_id, String(l.status)]));
  const prompts = (await fetchAll(sb, 'prompts', 'id,product_slug,scope,is_active,content')) ?? [];
  const questions = (await fetchAll(sb, 'question_pool', 'id,product_slug,rite,domain,question_role,active')) ?? [];
  const suggestions = (await fetchAll(sb, 'product_suggestions', 'id,title,funnel_stage,format,status,linked_product_id')) ?? [];

  const list = rows
    .map((r) => {
      const sc = stepCount(r.steps);
      return {
        slug: String(r.product_slug),
        name: String(r.name),
        group: r.product_group ?? null,
        plg_stage: r.plg_stage ?? null,
        price: r.price === null || r.price === undefined ? null : Number(r.price),
        steps_in_json: sc,
        total_steps: r.total_steps ?? null,
        steps_mismatch: sc !== null && r.total_steps !== null && sc !== Number(r.total_steps),
        is_active: r.is_active === true,
        is_purchasable: r.is_purchasable === true,
        has_stripe_price: Boolean(r.stripe_price_id),
        has_pillar: Boolean(r.pillar_id),
        system_prompt_words: words(r.system_prompt),
        deliverable_prompt_words: words(r.final_deliverable_prompt),
        landing_page: landingBy.get(r.id) ?? null,
        prompt_versions: prompts.filter((p) => p.product_slug === r.product_slug).length,
        questions: questions.filter((q) => q.product_slug === r.product_slug).length,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    available: true,
    total: rows.length,
    active: list.filter((p) => p.is_active).length,
    purchasable: list.filter((p) => p.is_purchasable).length,
    with_stripe_price: list.filter((p) => p.has_stripe_price).length,
    by_group: countBy(rows, (r) => r.product_group),
    list,
    landing_pages: { total: landing.length, by_status: countBy(landing, (l) => l.status) },
    prompts: {
      total: prompts.length,
      active: prompts.filter((p) => p.is_active === true).length,
      by_scope: countBy(prompts, (p) => p.scope),
      by_product: countBy(prompts, (p) => p.product_slug),
      words_total: prompts.reduce((s, p) => s + words(p.content), 0),
    },
    question_pool: {
      total: questions.length,
      active: questions.filter((q) => q.active === true).length,
      by_product: countBy(questions, (q) => q.product_slug),
      by_rite: countBy(questions, (q) => q.rite),
      by_role: countBy(questions, (q) => q.question_role),
    },
    suggestions: {
      total: suggestions.length,
      by_status: countBy(suggestions, (s) => s.status),
      by_funnel_stage: countBy(suggestions, (s) => s.funnel_stage),
      by_format: countBy(suggestions, (s) => s.format),
      linked_to_product: suggestions.filter((s) => s.linked_product_id).length,
      titles: suggestions.map((s) => String(s.title)).sort(),
    },
  };
}

async function email(sb: SupabaseClient) {
  const campaigns = await fetchAll(sb, 'campaigns', 'id,name,status,trigger_type,trigger_product_slug');
  const steps = await fetchAll(sb, 'campaign_steps', 'id,campaign_id,subject,html_body,text_body');
  const sequences = await exactCount(sb, 'email_sequences');
  return {
    campaigns: campaigns
      ? {
          total: campaigns.length,
          by_status: countBy(campaigns, (c) => c.status),
          by_trigger: countBy(campaigns, (c) => c.trigger_type),
          names: campaigns.map((c) => String(c.name)).sort(),
        }
      : { available: false },
    campaign_steps: steps
      ? {
          total: steps.length,
          words_total: steps.reduce((s, r) => s + words(r.text_body || r.html_body), 0),
        }
      : { available: false },
    email_sequences_rows: sequences,
  };
}

async function courses(sb: SupabaseClient) {
  return {
    course_definitions: (await fetchAll(sb, 'course_definitions', 'id,slug,title,status'))?.map((c) => ({
      slug: String(c.slug),
      title: String(c.title),
      status: c.status ?? null,
    })) ?? null,
    course_modules: await exactCount(sb, 'course_modules'),
    course_submodules: await exactCount(sb, 'course_submodules'),
    workshops: await exactCount(sb, 'workshops'),
    workshop_modules: await exactCount(sb, 'workshop_modules'),
    workshop_slides: await exactCount(sb, 'workshop_slides'),
  };
}

function mimeKind(m: string): string {
  if (m.includes('folder')) return 'folder';
  if (m.includes('document')) return 'doc';
  if (m.includes('spreadsheet')) return 'sheet';
  if (m.includes('presentation')) return 'deck';
  if (m.includes('pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'other';
}

async function driveIndex(sb: SupabaseClient) {
  // The Drive indexer (src/lib/google/drive-indexer.ts) upserts on doc_id with path/mime_type
  // columns, but the live content_index table may predate that migration and carry a different
  // shape. Detect the shape instead of assuming it; only path/mime/date fields are emitted.
  let orderCol = 'doc_id';
  const probe = await sb.from('content_index').select('doc_id').limit(1);
  if (probe.error) orderCol = 'id';
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('content_index')
      .select('*')
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { available: false, error: error.message };
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  const driveShape = orderCol === 'doc_id';
  if (!driveShape) {
    return {
      available: true,
      schema_matches_drive_indexer: false,
      note: 'content_index has no doc_id column, so Drive indexer upserts cannot land here',
      total: out.length,
      by_content_type: countBy(out, (r) => r.content_type),
    };
  }
  const files = out.filter((r) => !r.is_folder);
  const byFolder: Record<string, Counts> = {};
  for (const f of files) {
    const parts = String(f.path ?? '').split('/').filter(Boolean);
    const folder = parts.slice(0, Math.min(2, Math.max(parts.length - 1, 1))).join('/') || '(root)';
    const kind = mimeKind(String(f.mime_type ?? ''));
    byFolder[folder] ??= {};
    byFolder[folder][kind] = (byFolder[folder][kind] ?? 0) + 1;
  }
  return {
    available: true,
    schema_matches_drive_indexer: true,
    total: out.length,
    folders: out.length - files.length,
    files: files.length,
    by_kind: countBy(files, (f) => mimeKind(String(f.mime_type ?? ''))),
    by_folder: sortObj(Object.fromEntries(Object.entries(byFolder).map(([k, v]) => [k, sortObj(v)]))),
    last_synced_at: maxDate(out, 'last_synced_at'),
    newest_modified_at: maxDate(files, 'modified_time'),
    modified_last_30d: since(files, 'modified_time', 30),
  };
}

// ---------- repo files (no DB) ----------

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

function frontmatterField(src: string, field: string): string | null {
  const m = src.match(new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return m ? m[1] : null;
}

function repoFiles() {
  const rel = (p: string) => path.relative(REPO_ROOT, p);
  const contentDir = path.join(REPO_ROOT, 'src/content');
  const all = walk(contentDir);
  const mdx = all.filter((f) => f.endsWith('.mdx'));
  const stray = all.filter((f) => /\.(bak|backup\d*)$/.test(f)).map(rel);
  const mdxList = mdx.map((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const body = src.replace(/^---[\s\S]*?---/, '');
    return {
      path: rel(f),
      collection: rel(f).split(path.sep).slice(2, 4).join('/').replace(/\.mdx$/, ''),
      title: frontmatterField(src, 'title'),
      date: frontmatterField(src, 'date'),
      words: words(body),
    };
  });
  const byCollection: Counts = {};
  for (const m of mdxList) {
    const parts = m.path.split(path.sep);
    const key = parts.length > 4 ? `${parts[2]}/${parts[3]}` : parts[2];
    byCollection[key] = (byCollection[key] ?? 0) + 1;
  }
  const publicFiles = walk(path.join(REPO_ROOT, 'public'));
  const emailTemplates = walk(path.join(REPO_ROOT, 'src/lib/email/templates')).filter((f) => f.endsWith('.ts'));
  const productPages = walk(path.join(REPO_ROOT, 'src/app/(content)/products'))
    .filter((f) => f.endsWith('page.tsx'))
    .map((f) => path.basename(path.dirname(f)))
    .sort();
  const documents = walk(path.join(REPO_ROOT, 'documents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ path: rel(f), words: words(fs.readFileSync(f, 'utf8')) }));
  const docs = walk(path.join(REPO_ROOT, 'docs')).filter((f) => f.endsWith('.md'));
  const docsByFolder: Counts = {};
  for (const d of docs) {
    const parts = rel(d).split(path.sep);
    const k = parts.length > 2 ? parts[1] : '(root)';
    docsByFolder[k] = (docsByFolder[k] ?? 0) + 1;
  }
  return {
    mdx: {
      total: mdx.length,
      words_total: mdxList.reduce((s, m) => s + m.words, 0),
      by_collection: sortObj(byCollection),
      glossary_entries: mdx.filter((f) => rel(f).startsWith(path.join('src', 'content', 'glossary'))).length,
      list: mdxList,
    },
    stray_backup_files: stray,
    course_json_files: all.filter((f) => f.endsWith('.json')).map(rel),
    public_assets: {
      total: publicFiles.length,
      by_ext: countBy(publicFiles.map((f) => ({ e: path.extname(f).slice(1).toLowerCase() })), (r) => r.e),
    },
    email_templates: emailTemplates.map((f) => path.basename(f, '.ts')),
    product_marketing_pages: productPages,
    documents,
    docs_markdown: { total: docs.length, by_folder: sortObj(docsByFolder) },
  };
}

// ---------- main ----------

async function main() {
  const sb = client();
  const tables = await tableCounts(sb);
  const chunkNames = new Set<string>();
  const corpusOut = await corpus(sb, chunkNames);
  const result = {
    schema_version: 1,
    lens: '10-content-inventory',
    generated_at: new Date().toISOString(),
    table_counts: tables,
    corpus: corpusOut,
    knowledge_sources: await sources(sb, chunkNames),
    content_tree: await contentTree(sb),
    content_posts: await posts(sb),
    products: await products(sb),
    email: await email(sb),
    courses_and_workshops: await courses(sb),
    drive_index: await driveIndex(sb),
    repo: repoFiles(),
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`content-inventory data script failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
