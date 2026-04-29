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
      section: 'Studio',
      items: [
        {
          label: 'Studio Hub',
          href: '/admin/studio',
          icon: StudioIcon,
          active: pathname === '/admin/studio',
        },
        {
          label: 'Ebooks',
          href: '/admin/studio/ebook',
          icon: EbookIcon,
          active: pathname?.startsWith('/admin/studio/ebook'),
        },
        {
          label: 'Whitepapers',
          href: '/admin/studio/whitepaper',
          icon: WhitepaperIcon,
          active: pathname?.startsWith('/admin/studio/whitepaper'),
        },
        {
          label: 'Courses',
          href: '/admin/studio/ecourse',
          icon: CourseIcon,
          active: pathname?.startsWith('/admin/studio/ecourse'),
        },
        {
          label: 'Articles & Posts',
          href: '/admin/content',
          icon: ContentIcon,
          active: pathname?.startsWith('/admin/content'),
        },
        {
          label: 'Blog Calendar',
          href: '/admin/studio/blog-calendar',
          icon: CalendarIcon,
          active: pathname?.startsWith('/admin/studio/blog-calendar'),
          muted: true,
        },
        {
          label: 'Social Calendar',
          href: '/admin/studio/social-calendar',
          icon: CalendarIcon,
          active: pathname?.startsWith('/admin/studio/social-calendar'),
          muted: true,
        },
      ],
    },
    {
      section: 'AI Products',
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
      section: 'Intelligence',
      items: [
        {
          label: 'Strategy',
          href: '/admin/strategy',
          icon: StrategyIcon,
          active: pathname?.startsWith('/admin/strategy'),
        },
        {
          label: 'Corpus',
          href: '/admin/knowledge',
          icon: KnowledgeIcon,
          active: pathname?.startsWith('/admin/knowledge'),
        },
      ],
    },
    {
      section: 'People',
      items: [
        {
          label: 'Users',
          href: '/admin/users',
          icon: UsersIcon,
          active: pathname?.startsWith('/admin/users'),
        },
        {
          label: 'Discord',
          href: '/admin/discord',
          icon: DiscordIcon,
          active: pathname?.startsWith('/admin/discord'),
        },
      ],
    },
    {
      section: 'CRM',
      items: [
        {
          label: 'Lists',
          href: '/admin/lists',
          icon: ListsIcon,
          active: pathname?.startsWith('/admin/lists'),
        },
        {
          label: 'Campaigns',
          href: '/admin/campaigns',
          icon: CampaignsIcon,
          active: pathname?.startsWith('/admin/campaigns'),
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
                style={'muted' in item && item.muted ? { opacity: 0.55 } : undefined}
              >
                <item.icon className={styles.navIcon} />
                {item.label}
                {'muted' in item && item.muted && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.65rem', opacity: 0.7 }}>Soon</span>
                )}
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

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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

function EbookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function WhitepaperIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CourseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function StrategyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function StudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function KnowledgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ListsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
    </svg>
  );
}

function CampaignsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
