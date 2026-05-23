import Link from 'next/link';
import styles from './chart.module.css';

type ChartSection = 'birth-data' | 'western' | 'human-design' | 'vedic' | 'confirmed';

interface Props {
  section: ChartSection;
  hasBirthData: boolean;
}

const NAV_ITEMS: { key: ChartSection; label: string; icon: string; requiresBirthData?: boolean }[] = [
  { key: 'birth-data',    label: 'Birth Data',     icon: '✦' },
  { key: 'western',       label: 'Western',        icon: '☉', requiresBirthData: true },
  { key: 'human-design',  label: 'Human Design',   icon: '◈', requiresBirthData: true },
  { key: 'vedic',         label: 'Vedic',          icon: '◉', requiresBirthData: true },
];

export default function ChartSidebar({ section, hasBirthData }: Props) {
  return (
    <nav className={styles.sidebar}>
      <span className={styles.sidebarLabel}>Calculated</span>
      {NAV_ITEMS.map(item => {
        const disabled = item.requiresBirthData && !hasBirthData;
        const isActive = section === item.key;
        return (
          <Link
            key={item.key}
            href={`/dashboard/profile?tab=chart&section=${item.key}`}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            aria-disabled={disabled}
            style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
      <div className={styles.sidebarDivider} />
      <Link
        href="/dashboard/profile?tab=chart&section=confirmed"
        className={`${styles.navItem} ${section === 'confirmed' ? styles.navItemActive : ''}`}
      >
        <span className={styles.navIcon}>✓</span>
        Confirmed
      </Link>
    </nav>
  );
}
