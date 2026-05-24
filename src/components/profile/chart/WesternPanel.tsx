import type { WesternChart, PlanetName, Dignity } from '@/lib/calculator/types';
import styles from './chart.module.css';

const PLANET_LABELS: Partial<Record<PlanetName, string>> = {
  sun: '☉ Sun', moon: '☽ Moon', mercury: '☿ Mercury', venus: '♀ Venus',
  mars: '♂ Mars', jupiter: '♃ Jupiter', saturn: '♄ Saturn', uranus: '♅ Uranus',
  neptune: '♆ Neptune', pluto: '♇ Pluto', northNode: '☊ North Node',
  southNode: '☋ South Node', chiron: '⚷ Chiron',
};

function DignityBadge({ d }: { d: Dignity }) {
  const cls = {
    domicile: styles.dignityDomicile,
    exaltation: styles.dignityExaltation,
    detriment: styles.dignityDetriment,
    fall: styles.dignityFall,
    peregrine: styles.dignityPeregrine,
  }[d];
  return <span className={`${styles.dignityPill} ${cls}`}>{d}</span>;
}

interface Props {
  chart: WesternChart;
  designDate: Date;
  timeUnknown?: boolean;
}

export default function WesternPanel({ chart, designDate: _, timeUnknown }: Props) {
  const entries = Object.entries(chart.planets)
    .filter(([, p]) => p)
    .sort(([, a], [, b]) => (a!.house - b!.house) || (a!.sign.localeCompare(b!.sign)));

  return (
    <>
      <p className={styles.panelTitle}>Western Astrology</p>
      <p className={styles.panelSubtitle}>Tropical zodiac · {chart.houseSystem === 'whole-sign' ? 'Whole Sign houses' : 'Placidus houses'}</p>

      {timeUnknown && (
        <div className={styles.warningBanner}>
          Birth time unknown — Ascendant and house placements are based on 12:00 noon and may be inaccurate.
        </div>
      )}

      <table className={styles.chartTable}>
        <thead>
          <tr>
            <th>Planet</th>
            <th>Sign</th>
            <th>Degree</th>
            <th>House</th>
            <th>Dignity</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, p]) => (
            <tr key={name}>
              <td><span className={styles.planetName}>{PLANET_LABELS[name as PlanetName] ?? name}</span>{p!.retrograde && <span className={styles.retro}>℞</span>}</td>
              <td>{p!.sign}</td>
              <td>{p!.degree.toFixed(2)}°</td>
              <td>
                {timeUnknown
                  ? <span style={{ color: 'rgba(206,190,255,0.45)', fontStyle: 'italic' }}>~H{p!.house}</span>
                  : `H${p!.house}`}
              </td>
              <td><DignityBadge d={p!.dignity} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
