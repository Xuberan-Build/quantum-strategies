'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import styles from '@/app/dashboard/dashboard.module.css'

/**
 * One tab row for every profile page, so no profile screen is a dead end.
 * Settings, Goals and Chart Data live on /dashboard/profile?tab=…; Portrait is its own route.
 */
const TABS = [
  { key: 'settings', label: 'Settings', href: '/dashboard/profile?tab=settings' },
  { key: 'goals', label: 'Goals', href: '/dashboard/profile?tab=goals' },
  { key: 'chart', label: 'Chart Data', href: '/dashboard/profile?tab=chart' },
  { key: 'portrait', label: 'Portrait', href: '/dashboard/profile/portrait' },
] as const

export default function ProfileTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const active = pathname?.startsWith('/dashboard/profile/portrait')
    ? 'portrait'
    : (searchParams?.get('tab') ?? 'settings')

  return (
    <nav className={styles.tabRow} aria-label="Profile sections">
      {TABS.map(({ key, label, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
          className={`${styles.tabLink} ${active === key ? styles.tabLinkActive : ''}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
