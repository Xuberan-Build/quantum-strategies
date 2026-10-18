"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/lib/constants/navigation";
import styles from "./mobile-menu.module.css";
import DropdownPortal from "./DropdownPortal"; // reuse the portal

export default function MobileMenu() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Nav hrefs carry the canonical trailing slash; usePathname may not.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/(.)\/$/, "$1"));
  const toggleSection = (label: string) => setExpandedSection(expandedSection === label ? null : label);

  const closeMenu = () => {
    setIsOpen(false);
    setExpandedSection(null);
    setExpandedNodes({});
  };

  // Lock body scroll when the drawer is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderSubmenu = (links: any[], path: string[], depth = 0) => {
    return links.map((link) => {
      const nodeId = [...path, link.label].join(">");
      const hasSubmenu = Array.isArray(link.submenu) && link.submenu.length > 0;
      const isExpanded = Boolean(expandedNodes[nodeId]);
      const indent = `${2.5 + depth * 0.75}rem`;

      return (
        <div key={`${nodeId}-${link.href || "nolink"}`}>
          <div className={styles.subLinkRow}>
            {link.href ? (
              <Link
                href={link.href}
                className={`${styles.subLink} ${isActive(link.href) ? styles.active : ""}`}
                style={{ paddingLeft: indent }}
                onClick={closeMenu}
              >
                <div className={styles.subLinkContent}>
                  <div className={styles.subLinkLabel}>{link.label}</div>
                  {link.description && (
                    <div className={styles.subLinkDescription}>{link.description}</div>
                  )}
                </div>
              </Link>
            ) : (
              <div className={styles.subLinkLabelOnly} style={{ paddingLeft: indent }}>
                {link.label}
              </div>
            )}
            {hasSubmenu && (
              <button
                type="button"
                className={styles.subToggle}
                aria-expanded={isExpanded}
                aria-label={`Toggle ${link.label}`}
                onClick={() => toggleNode(nodeId)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
                     className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}>
                  <path d="M4 6l4 4 4-4" strokeWidth="2" stroke="currentColor" fill="none" />
                </svg>
              </button>
            )}
          </div>
          {hasSubmenu && isExpanded && (
            <div className={styles.nestedList}>
              {renderSubmenu(link.submenu, [...path, link.label], depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        className={styles.hamburger}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
        aria-controls="mobile-drawer"
      >
        <span className={`${styles.line} ${isOpen ? styles.lineOpen : ""}`} />
        <span className={`${styles.line} ${isOpen ? styles.lineOpen : ""}`} />
        <span className={`${styles.line} ${isOpen ? styles.lineOpen : ""}`} />
      </button>

      {/* Overlay + Drawer are portaled to <body> so they sit above page content */}
      {isOpen && (
        <DropdownPortal>
          <>
            {/* Overlay */}
            <div className={styles.overlay} onClick={closeMenu} aria-hidden="true" />

            {/* Drawer */}
            <div id="mobile-drawer" role="dialog" aria-modal="true" className={`${styles.drawer} ${styles.drawerOpen}`}>
              <div className={styles.drawerHeader}>
                <Link href="/" className={styles.drawerLogo} onClick={closeMenu}>
                  Quantum Strategies
                </Link>
                <button className={styles.closeButton} onClick={closeMenu} aria-label="Close menu">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <nav className={styles.drawerNav}>
                {navigationConfig.main.map((item) => {
                  // Simple link
                  if (item.href && !("dropdown" in item) && !("megaMenu" in item)) {
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`${styles.navLink} ${isActive(item.href) ? styles.active : ""}`}
                        onClick={closeMenu}
                      >
                        {item.label}
                      </Link>
                    );
                  }

                  // Dropdown section
                  if ("dropdown" in item && item.dropdown) {
                    return (
                      <div key={item.label} className={styles.section}>
                        <button className={styles.sectionButton} onClick={() => toggleSection(item.label)}>
                          {item.label}
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
                               className={`${styles.chevron} ${expandedSection === item.label ? styles.chevronOpen : ""}`}>
                            <path d="M4 6l4 4 4-4" strokeWidth="2" stroke="currentColor" fill="none" />
                          </svg>
                        </button>
                        {expandedSection === item.label && (
                          <div className={styles.sectionContent}>
                            {item.dropdown.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                className={`${styles.subLink} ${isActive(link.href) ? styles.active : ""}`}
                                onClick={closeMenu}
                              >
                                <div className={styles.subLinkContent}>
                                  <div className={styles.subLinkLabel}>{link.label}</div>
                                  {link.description && (
                                    <div className={styles.subLinkDescription}>{link.description}</div>
                                  )}
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Mega menu section
                  if ("megaMenu" in item && item.megaMenu) {
                    return (
                      <div key={item.label} className={styles.section}>
                        <button className={styles.sectionButton} onClick={() => toggleSection(item.label)}>
                          {item.label}
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
                               className={`${styles.chevron} ${expandedSection === item.label ? styles.chevronOpen : ""}`}>
                            <path d="M4 6l4 4 4-4" strokeWidth="2" stroke="currentColor" fill="none" />
                          </svg>
                        </button>
                        {expandedSection === item.label && (
                          <div className={styles.sectionContent}>
                            {item.megaMenu.sections.map((section) => (
                              <div key={section.title} className={styles.megaSection}>
                                {section.title && (
                                  <div className={styles.megaSectionTitle}>{section.title}</div>
                                )}
                                {renderSubmenu(section.links, [item.label, section.title || "links"])}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </nav>
            </div>
          </>
        </DropdownPortal>
      )}
    </>
  );
}
