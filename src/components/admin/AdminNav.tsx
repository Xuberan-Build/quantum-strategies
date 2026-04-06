'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@/app/admin/admin-layout.module.css';

interface AdminNavProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function AdminNav({ userName, userEmail, userRole }: AdminNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      section: 'Overview',
      items: [
        {
          label: 'Dashboard',
          href: '/admin',
          icon: DashboardIcon,
          active: pathname === '/admin',
        },
      ],
    },
    {
      section: 'Products',
      items: [
        {
          label: 'Products',
          href: '/admin/products',
          icon: ProductsIcon,
          active: pathname?.startsWith('/admin/products'),
        },
        {
          label: 'Prompts',
          href: '/admin/prompts',
          icon: PromptsIcon,
          active: pathname?.startsWith('/admin/prompts'),
        },
      ],
    },
    {
      section: 'Community',
      items: [
        {
          label: 'Discord',
          href: '/admin/discord',
          icon: DiscordIcon,
          active: pathname?.startsWith('/admin/discord'),
        },
      ],
    },
    {
      section: 'Content',
      items: [
        {
          label: 'Posts',
          href: '/admin/content',
          icon: ContentIcon,
          active: pathname?.startsWith('/admin/content'),
        },
      ],
    },
  ];

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : userEmail?.[0]?.toUpperCase() || 'A';

  return (
    <aside className={styles.adminSidebar}>
      {/* Brand */}
      <div className={styles.sidebarBrand}>
        <h1 className={styles.brandTitle}>Quantum Strategies</h1>
        <p className={styles.brandSubtitle}>Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className={styles.sidebarNav}>
        {navItems.map((section) => (
          <div key={section.section} className={styles.navSection}>
            <div className={styles.navSectionTitle}>{section.section}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${item.active ? styles.active : ''}`}
              >
                <item.icon className={styles.navIcon} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>{initials}</div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{userName || userEmail}</div>
            <div className={styles.userRole}>{userRole.replace('_', ' ')}</div>
          </div>
        </div>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeftIcon />
          Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}

// Icons
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
      />
    </svg>
  );
}

function ProductsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function PromptsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  );
}

function ContentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
