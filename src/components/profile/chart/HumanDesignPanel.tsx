import type { HumanDesignChart, HDActivations, HDCenter } from '@/lib/calculator/types';
import styles from './chart.module.css';

const ALL_CENTERS: HDCenter[] = ['Head','Ajna','Throat','G','Will','Solar Plexus','Sacral','Spleen','Root'];

const PLANET_SYMBOLS: Record<keyof HDActivations, string> = {
  sun: '☉', earth: '⊕', moon: '☽', northNode: '☊', southNode: '☋',
  mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄',
  uranus: '♅', neptune: '♆', pluto: '♇',
};

function ActivationsTable({ acts, title }: { acts: HDActivations; title: string }) {
  return (
    <div className={styles.gatesColumn}>
      <h4>{title}</h4>
      <table className={styles.chartTable}>
        <thead>
          <tr><th>Planet</th><th>Gate·Line</th><th>Center</th></tr>
        </thead>
        <tbody>
          {(Object.entries(acts) as [keyof HDActivations, HDActivations[keyof HDActivations]][]).map(([planet, act]) => (
            <tr key={planet}>
              <td>{PLANET_SYMBOLS[planet]} {planet.charAt(0).toUpperCase() + planet.slice(1)}</td>
              <td>{act.gate}·{act.line}</td>
              <td style={{ fontSize: '0.8rem', color: 'rgba(206,190,255,0.65)' }}>{act.center}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  chart: HumanDesignChart;
}

export default function HumanDesignPanel({ chart }: Props) {
  const definedSet = new Set(chart.definedCenters);

  return (
    <>
      <p className={styles.panelTitle}>Human Design</p>
      <p className={styles.panelSubtitle}>
        Design date: {chart.designDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
      </p>

      <div className={styles.hdGrid}>
        {[
          { label: 'Type',       value: chart.type },
          { label: 'Profile',    value: chart.profile },
          { label: 'Authority',  value: chart.authority },
          { label: 'Definition', value: chart.definition },
        ].map(({ label, value }) => (
          <div key={label} className={styles.hdStat}>
            <div className={styles.hdStatLabel}>{label}</div>
            <div className={styles.hdStatValue}>{value}</div>
          </div>
        ))}
      </div>

      <div className={styles.panelDivider} />

      <p className={styles.panelTitle} style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>Centers</p>
      <div className={styles.centersRow}>
        {ALL_CENTERS.map(c => (
          <span key={c} className={`${styles.centerPill} ${definedSet.has(c) ? styles.centerDefined : styles.centerUndefined}`}>
            {definedSet.has(c) ? '●' : '○'} {c}
          </span>
        ))}
      </div>

      {chart.definedChannels.length > 0 && (
        <>
          <div className={styles.panelDivider} />
          <p className={styles.panelTitle} style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>Channels</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {chart.definedChannels.map(ch => (
              <span key={ch} style={{
                padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.78rem',
                background: 'rgba(93,63,211,0.18)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#c4b5fd', fontWeight: 600,
              }}>{ch}</span>
            ))}
          </div>
        </>
      )}

      <div className={styles.panelDivider} />

      <div className={styles.gatesGrid}>
        <ActivationsTable acts={chart.conscious}   title="Conscious (Personality)" />
        <ActivationsTable acts={chart.unconscious} title="Unconscious (Design)" />
      </div>
    </>
  );
}
