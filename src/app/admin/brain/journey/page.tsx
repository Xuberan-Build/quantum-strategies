import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { JourneyTimeline } from '@/components/admin/brain/JourneyTimeline';
import { PageHead, StatTile } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import j from '@/components/admin/brain/journey.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';
import { formatDate } from '@/lib/brain/viz';

function groupBy<T>(items: readonly T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

export default async function BrainJourneyPage() {
  const { snapshot, error } = await getBrainSnapshot();
  if (!snapshot) return <BrainEmptyState error={error} />;
  const { eras, incidents, learnings, openQuestions } = snapshot.journey;

  const sortedIncidents = [...incidents].sort((a, b) => b.date.localeCompare(a.date));
  const themes = groupBy(learnings, (l) => l.theme);
  const questionGroups = groupBy(openQuestions, (q) => q.group);

  return (
    <div className={styles.content}>
      <PageHead eyebrow="Build journey" title="How the machine got built" lede="Eras on a real time axis, every incident with the guardrail it produced, what we learned, and what we still don't know." />

      <div className={styles.statGrid} style={{ marginBottom: '2rem' }}>
        <StatTile label="Eras" value={eras.length} />
        <StatTile label="Incidents and near-misses" value={incidents.length} />
        <StatTile label="Learnings" value={learnings.length} note={`${themes.length} themes`} />
        <StatTile label="Open questions" value={openQuestions.length} note={`${questionGroups.length} groups`} />
      </div>

      <section aria-labelledby="eras-title">
        <div className={styles.sectionHead}>
          <h2 id="eras-title" className={styles.sectionTitle}>
            Eras
          </h2>
          <span className={styles.count}>widths are durations · gaps are silences</span>
        </div>
        <JourneyTimeline eras={eras} />
      </section>

      <section className={styles.section} aria-labelledby="incidents-title">
        <div className={styles.sectionHead}>
          <h2 id="incidents-title" className={styles.sectionTitle}>
            Incidents → guardrails
          </h2>
          <span className={styles.count}>newest first</span>
        </div>
        {sortedIncidents.length === 0 ? (
          <p className={styles.muted}>No incidents recorded.</p>
        ) : (
          <ol className={j.incidents}>
            {sortedIncidents.map((inc, i) => (
              <li key={`${inc.date}-${i}`} className={j.incident}>
                <time className={j.incidentDate} dateTime={inc.date}>
                  {formatDate(inc.date)}
                </time>
                <div>
                  <h3 className={j.incidentTitle}>{inc.title}</h3>
                  <div className={j.flow}>
                    <div className={j.impact}>
                      <span className={j.flowLabel}>Impact</span>
                      <p>{inc.impact}</p>
                    </div>
                    <span className={j.arrow} aria-hidden="true">
                      →
                    </span>
                    <div className={j.guardrail}>
                      <span className={j.flowLabel}>Guardrail</span>
                      <p>{inc.guardrail}</p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.section} aria-labelledby="learnings-title">
        <div className={styles.sectionHead}>
          <h2 id="learnings-title" className={styles.sectionTitle}>
            Learnings by theme
          </h2>
        </div>
        <div className={j.themeGrid}>
          {themes.map(([theme, items]) => (
            <div key={theme} className={`${styles.card} ${j.theme}`}>
              <div className={styles.eyebrow}>{items.length} learnings</div>
              <h3 className={styles.cardTitle} style={{ margin: '0.3rem 0 0.8rem' }}>
                {theme}
              </h3>
              <ul className={styles.plainList}>
                {items.map((l, i) => (
                  <li key={`${i}-${l.text.slice(0, 12)}`}>{l.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="questions-title">
        <div className={styles.sectionHead}>
          <h2 id="questions-title" className={styles.sectionTitle}>
            Open questions
          </h2>
        </div>
        <div className={j.themeGrid}>
          {questionGroups.map(([group, items]) => (
            <div key={group} className={`${styles.card} ${j.theme}`}>
              <h3 className={styles.cardTitle} style={{ marginBottom: '0.6rem' }}>
                {group} <span className={styles.count}>{items.length}</span>
              </h3>
              {items.map((q, i) => (
                <div key={`${i}-${q.question.slice(0, 12)}`} className={j.question}>
                  <span className={j.questionMark} aria-hidden="true">
                    ?
                  </span>
                  <span>{q.question}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
