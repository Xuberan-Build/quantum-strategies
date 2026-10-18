"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/lib/constants/navigation";
import DropdownPortal from "../navigation/DropdownPortal";
import MobileMenu from "../navigation/MobileMenu";
import StackedMegaMenu from "../navigation/StackedMegaMenu";
import styles from "./product-header.module.css";

export default function ProductHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  const navItemRefs = useRef<{ [key: string]: HTMLLIElement | null }>({});
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Nav hrefs carry the canonical trailing slash; usePathname may not.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/(.)\/$/, "$1"));

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const updateDropdownPosition = (label: string) => {
    const element = navItemRefs.current[label];
    if (!element) return;
    const rect = element.getBoundingClientRect();

    const dropdownWidth = 280;
    const wouldOverflow = rect.left + dropdownWidth > window.innerWidth;
    const left = wouldOverflow ? rect.right - dropdownWidth : rect.left;

    setDropdownPosition({ top: rect.bottom + 8, left, width: rect.width });
  };

  const handleMouseEnter = (label: string) => {
    if (!isDesktop) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
    setActiveDropdown(label);
    updateDropdownPosition(label);
  };

  const handleMouseLeave = () => {
    if (!isDesktop) return;
    closeTimeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
  };

  const handleDropdownEnter = () => {
    if (!isDesktop) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  };

  const handleDropdownLeave = () => {
    if (!isDesktop) return;
    setActiveDropdown(null);
  };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const apply = () => {
      setIsDesktop(mq.matches);
      if (!mq.matches) setActiveDropdown(null);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ""}`}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoText}>Quantum Strategies</span>
        </Link>

        {/* Desktop Navigation */}
        {isDesktop && (
          <ul className={styles.navList}>
            {navigationConfig.main.map((item) => {
              if ("dropdown" in item && item.dropdown) {
                return (
                  <li
                    key={item.label}
                    ref={(el) => { navItemRefs.current[item.label] = el; }}
                    className={styles.navItem}
                    onMouseEnter={() => handleMouseEnter(item.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button className={styles.navLink}>
                      {item.label}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" style={{ marginLeft: 4 }}>
                        <path d="M6 9L1 4h10z" />
                      </svg>
                    </button>

                    {activeDropdown === item.label && (
                      <DropdownPortal>
                        <div
                          className={styles.dropdown}
                          style={{ position: "fixed", top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, minWidth: "280px" }}
                          onMouseEnter={handleDropdownEnter}
                          onMouseLeave={handleDropdownLeave}
                          role="menu"
                        >
                          {item.dropdown.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className={`${styles.dropdownLink} ${isActive(link.href) ? styles.active : ""}`}
                            >
                              <div>
                                <div className={styles.dropdownLabel}>{link.label}</div>
                                {link.description && <div className={styles.dropdownDescription}>{link.description}</div>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </DropdownPortal>
                    )}
                  </li>
                );
              }

              if ("megaMenu" in item && item.megaMenu) {
                return (
                  <li
                    key={item.label}
                    ref={(el) => { navItemRefs.current[item.label] = el; }}
                    className={styles.navItem}
                    onMouseEnter={() => handleMouseEnter(item.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button className={styles.navLink}>
                      {item.label}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" style={{ marginLeft: 4 }}>
                        <path d="M6 9L1 4h10z" />
                      </svg>
                    </button>

                    {activeDropdown === item.label && (
                      <DropdownPortal>
                        <div
                          style={{ position: "fixed", top: `${dropdownPosition.top}px`, left: "50%", transform: "translateX(-50%)" }}
                          onMouseEnter={handleDropdownEnter}
                          role="menu"
                        >
                          <StackedMegaMenu
                            isActive={isActive}
                            onMouseLeave={handleDropdownLeave}
                          />
                        </div>
                      </DropdownPortal>
                    )}
                  </li>
                );
              }

              // Portal button with special CTA styling
              if (item.label === "Portal") {
                return (
                  <li key={item.label} className={styles.navItem}>
                    <Link href={item.href!} className={styles.portalButton}>
                      <span className={styles.ctaText}>{item.label}</span>
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.label} className={styles.navItem}>
                  <Link href={item.href!} className={`${styles.navLink} ${isActive(item.href!) ? styles.active : ""}`}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* CTA Button */}
        <a href="#purchase" className={styles.ctaButton}>
          <span className={styles.ctaText}>Get Your Blueprint</span>
        </a>

        {/* Mobile Navigation */}
        {!isDesktop && <MobileMenu />}
      </div>
    </header>
  );
}
