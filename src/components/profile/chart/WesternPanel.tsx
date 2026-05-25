import type { WesternChart, PlanetName, Dignity, ZodiacSign } from '@/lib/calculator/types';
import styles from './chart.module.css';

const ZODIAC_SIGNS: ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const PLANET_ORDER: PlanetName[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
  'northNode', 'southNode', 'chiron',
];

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
  const risingDeg = chart.houses[0];
  const risingSign = ZODIAC_SIGNS[Math.floor(risingDeg / 30) % 12];
  const risingDegInSign = risingDeg % 30;

  const sun = chart.planets.sun;
  const moon = chart.planets.moon;

  const bigThree = [
    { label: 'Sun', symbol: '☉', sign: sun?.sign, degree: sun?.degree, dignity: sun?.dignity },
    { label: 'Moon', symbol: '☽', sign: moon?.sign, degree: moon?.degree, dignity: moon?.dignity },
    { label: 'Rising', symbol: '↑', sign: risingSign, degree: risingDegInSign, dignity: undefined },
  ];

  const orderedEntries = PLANET_ORDER
    .map(name => [name, chart.planets[name]] as const)
    .filter(([, p]) => p != null);

  return (
    <>
      <p className={styles.panelTitle}>Western Astrology</p>
      <p className={styles.panelSubtitle}>Tropical zodiac · {chart.houseSystem === 'whole-sign' ? 'Whole Sign houses' : 'Placidus houses'}</p>

      {timeUnknown && (
        <div className={styles.warningBanner}>
          Birth time unknown — Ascendant and house placements are based on 12:00 noon and may be inaccurate.
        </div>
      )}

      <div className={styles.bigThreeRow}>
        {bigThree.map(({ label, symbol, sign, degree, dignity }) => (
          <div key={label} className={styles.bigThreeCard}>
            <span className={styles.bigThreeSymbol}>{symbol}</span>
            <span className={styles.bigThreeLabel}>{label}</span>
            <span className={styles.bigThreeSign}>{sign ?? '—'}</span>
            {degree != null && (
              <span className={styles.bigThreeDeg}>{degree.toFixed(2)}°</span>
            )}
            {dignity && dignity !== 'peregrine' && (
              <span className={styles.bigThreeDignity}><DignityBadge d={dignity} /></span>
            )}
            {label === 'Rising' && timeUnknown && (
              <span className={styles.bigThreeDeg} style={{ color: 'rgba(251,191,36,0.7)', fontStyle: 'italic' }}>approx.</span>
            )}
          </div>
        ))}
      </div>

      <div className={styles.panelDivider} />

      <p className={styles.formLabel} style={{ marginBottom: '0.75rem' }}>All Placements</p>

      <div className={styles.tableScroll}>
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
          {orderedEntries.map(([name, p]) => (
            <tr key={name}>
              <td>
                <span className={styles.planetName}>{PLANET_LABELS[name as PlanetName] ?? name}</span>
                {p!.retrograde && <span className={styles.retro}>℞</span>}
              </td>
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
      </div>
    </>
  );
}
