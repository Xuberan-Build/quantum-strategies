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
}

export default function VedicPanel({ chart, birthUtc }: Props) {
  const entries = Object.entries(chart.planets)
    .filter(([, p]) => p)
    .sort(([, a], [, b]) => a!.house - b!.house);

  return (
    <>
      <p className={styles.panelTitle}>Vedic Astrology</p>
      <p className={styles.panelSubtitle}>
        Sidereal · Lahiri ayanamsa {chart.ayanamsa.toFixed(4)}° · Lagna {chart.lagna.sign} ({chart.lagna.nakshatra} pada {chart.lagna.pada})
      </p>

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
              <td>H{p!.house}</td>
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
                const isActive = d.start <= birthUtc && birthUtc < d.end;
                return (
                  <tr key={i} style={isActive ? { background: 'rgba(93,63,211,0.12)' } : undefined}>
                    <td><span className={styles.planetName}>{d.lord}</span>{isActive && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#a78bfa' }}>current</span>}</td>
                    <td style={{ fontSize: '0.82rem', color: 'rgba(206,190,255,0.65)' }}>{d.start.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</td>
                    <td style={{ fontSize: '0.82rem', color: 'rgba(206,190,255,0.65)' }}>{d.end.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</td>
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
