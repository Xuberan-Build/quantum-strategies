import Link from "next/link";
import { navigationConfig } from "@/lib/constants/navigation";
import styles from "./footer.module.css";

type MenuLink = { label: string; href?: string; submenu?: MenuLink[] };

// The mega menu builds its links on hover, so crawlers never see them.
// The footer repeats the article structure as plain links on every page.
function articleNav() {
  const resources = navigationConfig.main.find((item) => item.label === "Resources") as
    | { megaMenu?: { sections: { links: MenuLink[] }[] } }
    | undefined;
  const articles = resources?.megaMenu?.sections
    .flatMap((section) => section.links)
    .find((link) => link.label === "Articles");
  const categories = (articles?.submenu ?? []).filter((c) => c.href && c.href !== "/articles/");
  const featured = categories.find((c) => c.submenu?.length && c.label.startsWith("Start here"));
  const topics = categories.filter((c) => c !== featured);
  return { featured, topics };
}

export default function Footer() {
  const { featured, topics } = articleNav();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <nav className={styles.readRow} aria-label="Articles">
          {featured && (
            <div>
              <h4 className={styles.columnTitle}>
                <Link href={featured.href!} className={styles.link}>{featured.label}</Link>
              </h4>
              <ul className={styles.readList}>
                {featured.submenu!.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href!} className={styles.link}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className={styles.columnTitle}>
              <Link href="/articles/" className={styles.link}>Articles by topic</Link>
            </h4>
            <ul className={styles.readList}>
              {topics.map((topic) => (
                <li key={topic.href}>
                  <Link href={topic.href!} className={styles.link}>{topic.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/articles/waveforms/" className={styles.link}>The Waveforms series</Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className={styles.grid}>
          {/* Brand Column */}
          <div className={styles.brandColumn}>
            <h3 className={styles.brandName}>Quantum Strategies</h3>
            <p className={styles.brandTagline}>
              Mastering the art of creating and adding value through strategic execution
            </p>
            <div className={styles.social}>
              <a
                href="https://www.linkedin.com/in/austinsantos"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="LinkedIn"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Company Links */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Company</h4>
            <ul className={styles.linkList}>
              {navigationConfig.footer.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Resources</h4>
            <ul className={styles.linkList}>
              {navigationConfig.footer.resources.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Work Links */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Our Work</h4>
            <ul className={styles.linkList}>
              {navigationConfig.footer.work.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Legal</h4>
            <ul className={styles.linkList}>
              {navigationConfig.footer.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Quantum Strategies. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
