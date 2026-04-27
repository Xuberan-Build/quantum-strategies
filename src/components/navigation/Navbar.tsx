"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/lib/constants/navigation";
import DropdownPortal from "./DropdownPortal";
import MobileMenu from "./MobileMenu";
import StackedMegaMenu from "./StackedMegaMenu";
import styles from "./navbar.module.css";

interface NavbarProps {
  showProductCTA?: boolean;
  productCTAText?: string;
  productCTAHref?: string;
}

export default function Navbar({ showProductCTA = false, productCTAText = "Get Your Blueprint", productCTAHref = "#purchase" }: NavbarProps) {
  const pathname = usePathname();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Track desktop breakpoint; use the same 1024px cutoff as your CSS
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  const navItemRefs = useRef<{ [key: string]: HTMLLIElement | null }>({});
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const updateDropdownPosition = (label: string) => {
    const element = navItemRefs.current[label];
    if (!element) return;
    const rect = element.getBoundingClientRect();

    // Check if dropdown would overflow on the right side
    const dropdownWidth = 280; // min-width from CSS
    const wouldOverflow = rect.left + dropdownWidth > window.innerWidth;

    // If it would overflow, align to the right edge of the button instead
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

  // Watch breakpoint
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
    <nav className={styles.navbar} aria-label="Main navigation">
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>Quantum Strategies</Link>

        {/* Desktop Navigation: render only on desktop */}
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
                // Convert megaMenu data to StackedMegaMenu format
                const menuData = item.megaMenu.sections.flatMap(section =>
                  section.links.map(link => ({
                    label: link.label,
                    href: link.href,
                    description: (link as any).description, // Pass through description (type-safe cast)
                    categories: (link as any).submenu?.map((sub: any) => ({
                      label: sub.label,
                      href: sub.href, // Pass through href for clickable categories
                      articles: sub.submenu?.map((subItem: any) => ({
                        label: subItem.label,
                        href: subItem.href
                      })) || []
                    }))
                  }))
                );

                const triggerChevron = (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" style={{ marginLeft: 4 }}>
                    <path d="M6 9L1 4h10z" />
                  </svg>
                );

                return (
                  <li
                    key={item.label}
                    ref={(el) => { navItemRefs.current[item.label] = el; }}
                    className={styles.navItem}
                    onMouseEnter={() => handleMouseEnter(item.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {"href" in item && item.href ? (
                      <Link href={item.href} className={`${styles.navLink} ${isActive(item.href) ? styles.active : ""}`}>
                        {item.label}{triggerChevron}
                      </Link>
                    ) : (
                      <button className={styles.navLink}>
                        {item.label}{triggerChevron}
                      </button>
                    )}

                    {activeDropdown === item.label && (
                      <DropdownPortal>
                        <div
                          style={{ position: "fixed", top: `${dropdownPosition.top}px`, left: "50%", transform: "translateX(-50%)", zIndex: 999999 }}
                          onMouseEnter={handleDropdownEnter}
                          role="menu"
                        >
                          <StackedMegaMenu
                            isActive={isActive}
                            onMouseLeave={handleDropdownLeave}
                            menuData={menuData}
                          />
                        </div>
                      </DropdownPortal>
                    )}
                  </li>
                );
              }

              // Portal button with special CTA styling (hide on product pages)
              if (item.label === "Portal" && !showProductCTA) {
                return (
                  <li key={item.label} className={styles.navItem}>
                    <Link href={item.href!} className={styles.portalButton}>
                      {item.label}
                    </Link>
                  </li>
                );
              }

              // Skip Portal entirely on product pages
              if (item.label === "Portal" && showProductCTA) {
                return null;
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

        {/* Product CTA Button (optional, for product pages) */}
        {showProductCTA && isDesktop && (
          <a href={productCTAHref} className={styles.productCTA}>
            <span className={styles.ctaText}>{productCTAText}</span>
          </a>
        )}

        {/* Mobile Navigation: render only on mobile */}
        {!isDesktop && <MobileMenu />}
      </div>
    </nav>
  );
}
