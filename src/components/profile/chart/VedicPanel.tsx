import type { VedicChart, PlanetName } from '@/lib/calculator/types';
import styles from './chart.module.css';

const PLANET_LABELS: Partial<Record<PlanetName, string>> = {
  sun: '☉ Sun', moon: '☽ Moon', mercury: '☿ Mercury', venus: '♀ Venus',
  mars: '♂ Mars', jupiter: '♃ Jupiter', saturn: '♄ Saturn', uranus: '♅ Uranus',
  neptune: '♆ Neptune', pluto: '♇ Pluto', northNode: 'Rahu', southNode: 'Ketu',
};

interface Props {
  chart: VedicChart;
  birthUtc: Date;
  timeUnknown?: boolean;
}

export default function VedicPanel({ chart, birthUtc, timeUnknown }: Props) {
  const entries = Object.entries(chart.planets)
    .filter(([, p]) => p)
    .sort(([, a], [, b]) => a!.house - b!.house);

  const lagnaLabel = timeUnknown
    ? `~${chart.lagna.sign} (${chart.lagna.nakshatra} pada ${chart.lagna.pada})`
    : `${chart.lagna.sign} (${chart.lagna.nakshatra} pada ${chart.lagna.pada})`;

  return (
    <>
      <p className={styles.panelTitle}>Vedic Astrology</p>
      <p className={styles.panelSubtitle}>
        Sidereal · Lahiri ayanamsa {chart.ayanamsa.toFixed(4)}° · Lagna {lagnaLabel}
        {timeUnknown && <span style={{ marginLeft: '0.35rem', color: 'rgba(252,211,77,0.7)', fontStyle: 'italic' }}>(approx.)</span>}
      </p>

      {timeUnknown && (
        <div className={styles.warningBanner}>
          Birth time unknown — Lagna (Ascendant) and house placements are based on 12:00 noon and may be inaccurate.
        </div>
      )}

      <table className={styles.chartTable}>
        <thead>
          <tr>
            <th>Planet</th>
            <th>Sign</th>
            <th>Degree</th>
            <th>Nakshatra</th>
            <th>Pada</th>
            <th>House</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, p]) => (
            <tr key={name}>
              <td>
                <span className={styles.planetName}>{PLANET_LABELS[name as PlanetName] ?? name}</span>
                {p!.retrograde && <span className={styles.retro}>℞</span>}
              </td>
              <td>{p!.sign}</td>
              <td>{p!.degree.toFixed(2)}°</td>
              <td style={{ fontSize: '0.82rem' }}>{p!.nakshatra}</td>
              <td>{p!.pada}</td>
              <td>
                {timeUnknown
                  ? <span style={{ color: 'rgba(206,190,255,0.45)', fontStyle: 'italic' }}>~H{p!.house}</span>
                  : `H${p!.house}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {chart.dashas.length > 0 && (
        <>
          <div className={styles.panelDivider} />
          <p className={styles.panelTitle} style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Vimshottari Dashas</p>
          <table className={styles.chartTable}>
            <thead>
              <tr><th>Lord</th><th>Start</th><th>End</th></tr>
            </thead>
            <tbody>
              {chart.dashas.map((d, i) => {
                const dStart = new Date(d.start);
                const dEnd = new Date(d.end);
                const isActive = dStart <= birthUtc && birthUtc < dEnd;
                return (
                  <tr key={i} style={isActive ? { background: 'rgba(93,63,211,0.12)' } : undefined}>
                    <td><span className={styles.planetName}>{d.lord}</span>{isActive && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#a78bfa' }}>current</span>}</td>
                    <td style={{ fontSize: '0.82rem', color: 'rgba(206,190,255,0.65)' }}>{dStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</td>
                    <td style={{ fontSize: '0.82rem', color: 'rgba(206,190,255,0.65)' }}>{dEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
