'use client';

/**
 * /admin/brain/search: Search Console, read against the topical map.
 *
 * Three views: tracked head terms (every topic's chosen title phrase and where it ranks), all keywords
 * (every query Google showed us for, with its topic and Keyword Planner volume) and pages (with Google's index
 * verdict from URL Inspection). Filters by pillar and topic. Data comes from src/lib/seo/search-report.ts.
 */
import { useMemo, useState } from 'react';
import type { HeadTermRow, KeywordRow, PageRow, SearchReport } from '@/lib/seo/search-report';
import styles from '../brain.module.css';
import s from './search.module.css';

type View = 'head' | 'keywords' | 'pages';

const fmt = (n: number) => n.toLocaleString('en-US');
const pos = (p: number | null) => (p === null ? '–' : p.toFixed(1));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const SITE = 'https://quantumstrategies.online';
const shortUrl = (u: string) => (u.startsWith(SITE) ? u.slice(SITE.length) || '/' : u);

/** Position change: positive = moved up (a smaller number is better). */
function PositionDelta({ now, before }: { now: number | null; before: number | null }) {
  if (now === null && before === null) return <span className={styles.muted}>–</span>;
  if (before === null) return <span className={s.up}>new</span>;
  if (now === null) return <span className={s.down}>lost</span>;
  const d = before - now;
  if (Math.abs(d) < 0.1) return <span className={styles.muted}>±0</span>;
  return <span className={d > 0 ? s.up : s.down}>{d > 0 ? `▲ ${d.toFixed(1)}` : `▼ ${Math.abs(d).toFixed(1)}`}</span>;
}

function changeLabel(now: number, before: number): string | undefined {
  if (!before) return now ? 'new this period' : undefined;
  const d = Math.round(((now - before) / before) * 100);
  return `${d >= 0 ? '+' : ''}${d}% vs previous`;
}

function Trend({ daily }: { daily: SearchReport['daily'] }) {
  if (daily.length < 2) return null;
  const w = 640;
  const h = 120;
  const maxI = Math.max(1, ...daily.map((d) => d.impressions));
  const maxC = Math.max(1, ...daily.map((d) => d.clicks));
  const x = (i: number) => (i / (daily.length - 1)) * w;
  const line = (vals: number[], max: number) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(h - (v / max) * (h - 8) - 4).toFixed(1)}`).join(' ');
  return (
    <figure className={styles.figure}>
      <div className={styles.figureHead}>
        <div>
          <div className={styles.figureTitle}>Daily trend</div>
          <div className={styles.figureCaption}>
            <span className={s.keyImpressions}>Impressions</span> (peak {fmt(maxI)}) and <span className={s.keyClicks}>clicks</span> (peak {fmt(maxC)}), each on its own scale. {daily[0].date} to {daily[daily.length - 1].date}.
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className={s.trend} role="img" aria-label="Daily impressions and clicks">
        <path d={line(daily.map((d) => d.impressions), maxI)} className={s.lineImpressions} />
        <path d={line(daily.map((d) => d.clicks), maxC)} className={s.lineClicks} />
      </svg>
    </figure>
  );
}

function IndexChip({ verdict, state }: { verdict: string | null | undefined; state: string | null | undefined }) {
  if (!verdict) return <span className={`${s.chip} ${s.chipNone}`}>not inspected</span>;
  const cls = verdict === 'PASS' ? s.chipPass : verdict === 'NEUTRAL' ? s.chipNeutral : s.chipFail;
  return (
    <span className={`${s.chip} ${cls}`} title={state ?? verdict}>
      {verdict === 'PASS' ? 'indexed' : state ?? verdict.toLowerCase()}
    </span>
  );
}

export function SearchConsoleView({ report }: { report: SearchReport }) {
  const [view, setView] = useState<View>('head');
  const [pillar, setPillar] = useState('all');
  const [topic, setTopic] = useState('all');
  const [q, setQ] = useState('');
  const [mappedOnly, setMappedOnly] = useState(false);

  const topics = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of [...report.headTerms.map((h) => h.topic), ...report.keywords.map((k) => k.topic), ...report.pages.map((p) => p.topic)]) {
      if (r && (pillar === 'all' || r.pillarCode === pillar)) m.set(r.id, r.label);
    }
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [report, pillar]);

  const keep = (t: { pillarCode: string; id: string } | null, text: string) => {
    if (pillar !== 'all' && t?.pillarCode !== pillar) return false;
    if (topic !== 'all' && t?.id !== topic) return false;
    if (mappedOnly && !t) return false;
    return !q || text.toLowerCase().includes(q.toLowerCase());
  };

  const head = report.headTerms.filter((h) => keep(h.topic, `${h.headTerm} ${h.topic.label}`));
  const keywords = report.keywords.filter((k) => keep(k.topic, `${k.query} ${k.topic?.label ?? ''}`));
  const pages = report.pages.filter((p) => keep(p.topic, `${p.page} ${p.topic?.label ?? ''}`));
  const ranking = report.headTerms.filter((h) => h.position !== null).length;

  const t = report.totals;
  const pt = report.prevTotals;

  return (
    <>
      {(!report.configured.siteUrl || !report.configured.credentials) && (
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
          <div>
            <span className={styles.bannerLabel}>Not connected yet</span>
            Search Console is not wired up on this deployment. {!report.configured.siteUrl && 'GSC_SITE_URL is missing. '}
            {!report.configured.credentials && 'The service account credentials are missing. '}
            Once they are set and the service account is a user on the property, the daily sync (09:30 UTC) fills this page. The full 16-month history comes from one local run: npx tsx scripts/seo/gsc-sync.ts --backfill.
          </div>
        </div>
      )}
      {report.configured.siteUrl && report.configured.credentials && !report.hasData && (
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
          <div>
            <span className={styles.bannerLabel}>No data yet</span>
            Connected to {report.configured.siteUrl}, but nothing has synced. Run the backfill once (npx tsx scripts/seo/gsc-sync.ts --backfill) or wait for the next daily sync.
          </div>
        </div>
      )}

      <section className={styles.section} aria-label="Overview">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>The last {report.period ? '28 days' : 'period'} on Google</h2>
          {report.period && (
            <span className={styles.count}>
              {report.period.startDate} to {report.period.endDate} · compared with the 28 days before · synced {report.lastFetched?.slice(0, 16).replace('T', ' ')} UTC
            </span>
          )}
        </div>
        <div className={styles.statGrid}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Clicks from Google search</div>
            <div className={styles.statValue}>{fmt(t.clicks)}</div>
            <div className={styles.statNote}>{changeLabel(t.clicks, pt.clicks) ?? 'Visits that came from a Google result.'}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Impressions</div>
            <div className={styles.statValue}>{fmt(t.impressions)}</div>
            <div className={styles.statNote}>{changeLabel(t.impressions, pt.impressions) ?? 'Times a page showed in results.'}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Average position</div>
            <div className={styles.statValue}>{pos(t.position)}</div>
            <div className={styles.statNote}>{pt.position !== null && t.position !== null ? `${pt.position.toFixed(1)} before. Lower is better; page one is 1 to 10.` : 'Impression-weighted. Page one is 1 to 10.'}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Click-through rate</div>
            <div className={styles.statValue}>{pct(t.ctr)}</div>
            <div className={styles.statNote}>{pt.impressions ? `${pct(pt.ctr)} before.` : 'Clicks divided by impressions.'}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Pages on Google</div>
            <div className={styles.statValue}>
              {fmt(report.index.indexed)}
              <span className={styles.statDelta}>of {fmt(report.index.inspected)} inspected</span>
            </div>
            <div className={styles.statNote}>
              {report.index.inspected ? `${fmt(report.index.notIndexed)} not indexed. URL Inspection, last run ${report.index.lastInspected?.slice(0, 10)}.` : 'URL Inspection has not run yet.'}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Head terms ranking</div>
            <div className={styles.statValue}>
              {fmt(ranking)}
              <span className={styles.statDelta}>of {fmt(report.headTerms.length)}</span>
            </div>
            <div className={styles.statNote}>Topics whose title phrase earned at least one impression.</div>
          </div>
        </div>
        <p className={s.why}>
          <span className={s.whyTag}>Why it matters</span>
          Search is the slow, compounding front door to the quiz and the Rites. The map says what people search for; this page says whether Google shows us for it yet. A head term at 11 to 20 is the cheapest win: one refresh can move it onto page one.
        </p>
        <Trend daily={report.daily} />
        {report.index.states.length > 0 && (
          <p className={s.hint}>
            Index states: {report.index.states.map((x) => `${x.state} (${x.count})`).join(' · ')}
          </p>
        )}
      </section>

      <section className={styles.section} aria-label="Keywords and pages">
        <div className={styles.filterRow}>
          <div className={styles.segmented} role="tablist" aria-label="View">
            {(
              [
                ['head', `Tracked head terms · ${report.headTerms.length}`],
                ['keywords', `All keywords · ${report.keywords.length}`],
                ['pages', `Pages · ${report.pages.length}`],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={`${styles.segment} ${view === v ? styles.segmentActive : ''}`} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
          <label className={s.field}>
            <span className={styles.filterLabel}>Pillar</span>
            <select
              className={s.select}
              value={pillar}
              onChange={(e) => {
                setPillar(e.target.value);
                setTopic('all');
              }}
            >
              <option value="all">All</option>
              {report.pillars.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span className={styles.filterLabel}>Topic</span>
            <select className={s.select} value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">All</option>
              {topics.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {view !== 'head' && (
            <label className={s.field}>
              <input type="checkbox" checked={mappedOnly} onChange={(e) => setMappedOnly(e.target.checked)} />
              <span className={styles.filterLabel}>On the map only</span>
            </label>
          )}
          <input className={styles.search} type="search" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter rows" />
        </div>

        {view === 'head' && <HeadTable rows={head} />}
        {view === 'keywords' && <KeywordTable rows={keywords} />}
        {view === 'pages' && <PageTable rows={pages} />}
      </section>
    </>
  );
}

function HeadTable({ rows }: { rows: HeadTermRow[] }) {
  return (
    <>
      <p className={s.lede}>Every topic&apos;s head term: the highest-volume phrasing from Keyword Planner, the one a page or video on it gets titled with. Position is Google&apos;s average for that exact phrase over the period.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Head term</th>
              <th>Topic</th>
              <th className={styles.num}>Searches/mo</th>
              <th className={styles.num}>Position</th>
              <th className={styles.num}>Change</th>
              <th className={styles.num}>Clicks</th>
              <th className={styles.num}>Impressions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.topic.id}>
                <td>&ldquo;{r.headTerm}&rdquo;</td>
                <td>
                  <a className={s.link} href={`/admin/brain/map?topic=${encodeURIComponent(r.topic.id)}`}>
                    {r.topic.label}
                  </a>{' '}
                  <span className={styles.muted}>{r.topic.pillarCode}</span>
                </td>
                <td className={styles.num}>{fmt(r.volume)}</td>
                <td className={styles.num}>{r.position === null ? <span className={styles.muted}>not ranking yet</span> : pos(r.position)}</td>
                <td className={styles.num}>{r.position === null && r.prevPosition === null ? '' : <PositionDelta now={r.position} before={r.prevPosition} />}</td>
                <td className={styles.num}>{fmt(r.clicks)}</td>
                <td className={styles.num}>{fmt(r.impressions)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className={styles.muted}>
                  No topics with a head term match these filters. Head terms come from the Keyword Planner build of the topical map.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KeywordTable({ rows }: { rows: KeywordRow[] }) {
  return (
    <>
      <p className={s.lede}>Every query Google showed us for, most impressions first. Topic comes from the map&apos;s phrasings, or from the page that ranked when the phrasing is new to the map. Google hides rare queries for privacy, so these add up to less than the totals above.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Query</th>
              <th>Topic</th>
              <th className={styles.num}>Searches/mo</th>
              <th className={styles.num}>Position</th>
              <th className={styles.num}>Change</th>
              <th className={styles.num}>Clicks</th>
              <th className={styles.num}>Impressions</th>
              <th className={styles.num}>CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 1000).map((r) => (
              <tr key={r.query}>
                <td title={r.page ?? undefined}>{r.query}</td>
                <td>
                  {r.topic ? (
                    <>
                      <a className={s.link} href={`/admin/brain/map?topic=${encodeURIComponent(r.topic.id)}`}>
                        {r.topic.label}
                      </a>{' '}
                      <span className={styles.muted}>{r.topic.pillarCode}</span>
                    </>
                  ) : (
                    <span className={styles.muted}>not on the map</span>
                  )}
                </td>
                <td className={styles.num}>{r.volume === null ? '–' : fmt(r.volume)}</td>
                <td className={styles.num}>{pos(r.position)}</td>
                <td className={styles.num}>
                  <PositionDelta now={r.position} before={r.prevPosition} />
                </td>
                <td className={styles.num}>{fmt(r.clicks)}</td>
                <td className={styles.num}>{fmt(r.impressions)}</td>
                <td className={styles.num}>{pct(r.ctr)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className={styles.muted}>
                  No queries yet for these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 1000 && <p className={s.lede}>Showing the first 1,000 of {fmt(rows.length)}. Narrow with the filters.</p>}
    </>
  );
}

function PageTable({ rows }: { rows: PageRow[] }) {
  return (
    <>
      <p className={s.lede}>Pages with search impressions this period, plus every page URL Inspection has checked. Index status is Google&apos;s own verdict for the URL, refreshed on a rotation of about 100 pages a day.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Page</th>
              <th>Topic</th>
              <th>On Google</th>
              <th className={styles.num}>Clicks</th>
              <th className={styles.num}>Change</th>
              <th className={styles.num}>Impressions</th>
              <th className={styles.num}>Position</th>
              <th>Last crawl</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.page}>
                <td>
                  <a className={s.link} href={r.page} target="_blank" rel="noreferrer">
                    {shortUrl(r.page)}
                  </a>
                </td>
                <td>{r.topic ? r.topic.label : <span className={styles.muted}>–</span>}</td>
                <td>
                  <IndexChip verdict={r.inspection?.verdict} state={r.inspection?.coverage_state} />
                </td>
                <td className={styles.num}>{fmt(r.clicks)}</td>
                <td className={styles.num}>{r.clicks - r.prevClicks === 0 ? <span className={styles.muted}>±0</span> : <span className={r.clicks > r.prevClicks ? s.up : s.down}>{r.clicks > r.prevClicks ? '+' : ''}{fmt(r.clicks - r.prevClicks)}</span>}</td>
                <td className={styles.num}>{fmt(r.impressions)}</td>
                <td className={styles.num}>{pos(r.position)}</td>
                <td>{r.inspection?.last_crawl_time?.slice(0, 10) ?? <span className={styles.muted}>–</span>}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className={styles.muted}>
                  No pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
