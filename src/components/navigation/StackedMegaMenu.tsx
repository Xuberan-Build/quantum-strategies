"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "./stacked-mega-menu.module.css";

interface Article {
  label: string;
  href: string;
}

interface Category {
  label: string;
  href?: string; // Categories can now be clickable
  articles: Article[];
}

interface ContentType {
  label: string;
  href?: string;
  description?: string;
  categories?: Category[];
}

interface StackedMegaMenuProps {
  isActive: (href: string) => boolean;
  onMouseLeave: () => void;
  menuData?: ContentType[]; // Optional menu data
}

const defaultContentTypes: ContentType[] = [
  {
    label: "Articles",
    href: "/articles/",
    categories: [
      {
        label: "Customer Acquisition",
        articles: [
          { label: "Customer Acquisition Hub", href: "/articles/customer-acquisition/" },
          { label: "B2B Digital Marketing", href: "/articles/b2b-digital-marketing-strategy/" },
          { label: "SEO Lead Generation", href: "/articles/seo-lead-generation/" },
          { label: "Content Marketing", href: "/articles/content-marketing/" },
        ],
      },
      {
        label: "Operations",
        articles: [
          { label: "Operations Hub", href: "/articles/operations/" },
          { label: "Automation Tools", href: "/articles/automation-tools/" },
          { label: "CRM Implementation", href: "/articles/crm-implementation/" },
          { label: "Marketing Operations", href: "/articles/marketing-operations/" },
        ],
      },
      {
        label: "Product Development",
        articles: [
          { label: "Product Development Hub", href: "/articles/product-development/" },
          { label: "MVP Strategy", href: "/articles/mvp-strategy/" },
          { label: "Product Market Fit", href: "/articles/product-market-fit/" },
          { label: "User Research", href: "/articles/user-research/" },
        ],
      },
    ],
  },
  {
    label: "Courses",
    href: "/courses/",
    categories: [
      {
        label: "Visionary Creator's Activation Protocol",
        articles: [
          { label: "Reprogram Your Consciousness for Creative Life Mastery", href: "/courses/vcap/" },
          { label: "3 Modules • 125+ Interactive Slides • 8 Hours", href: "/courses/vcap/" },
          { label: "Preview Module 1 Free →", href: "/courses/vcap/" },
        ],
      },
    ],
  },
  {
    label: "White Papers",
    href: "/whitepapers/",
  },
  { label: "Case Studies", href: "/portfolio/" },
];

export default function StackedMegaMenu({ isActive, onMouseLeave, menuData }: StackedMegaMenuProps) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Use provided menuData or fall back to default (Resources)
  const contentTypes = menuData || defaultContentTypes;

  const handleTypeHover = (label: string) => {
    setActiveType(label);
    setActiveCategory(null);
  };

  const handleCategoryHover = (label: string) => {
    setActiveCategory(label);
  };

  const activeTypeData = contentTypes.find((t) => t.label === activeType);
  const activeCategoryData = activeTypeData?.categories?.find((c) => c.label === activeCategory);
  const hasDenseCategories = (activeTypeData?.categories?.length || 0) >= 5;
  // Dense menus show categories as a column with a panel beside it; the panel
  // falls back to the first category that has articles (the featured series).
  const panelCategory =
    activeCategoryData ??
    (hasDenseCategories ? activeTypeData?.categories?.find((c) => c.articles.length > 0) : undefined);

  return (
    <div className={styles.stackedMenu} onMouseLeave={onMouseLeave}>
      {/* Row 1: Content Types (Horizontal) - This IS the header */}
      <div className={`${styles.row} ${styles.headerRow}`}>
        {contentTypes.map((type) => (
          <div
            key={type.label}
            className={`${styles.typeItem} ${activeType === type.label ? styles.active : ""}`}
            onMouseEnter={() => handleTypeHover(type.label)}
          >
            {type.href ? (
              <Link href={type.href} className={styles.typeLink}>
                <span className={styles.typeLabelText}>
                  {type.label}
                  {type.description && (
                    <span className={styles.typeDescription}>{type.description}</span>
                  )}
                </span>
                {type.categories && <span className={styles.arrow}>▶</span>}
              </Link>
            ) : (
              <span className={styles.typeLabel}>
                <span className={styles.typeLabelText}>
                  {type.label}
                  {type.description && (
                    <span className={styles.typeDescription}>{type.description}</span>
                  )}
                </span>
                {type.categories && <span className={styles.arrow}>▶</span>}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Row 2: Categories - horizontal, or a column beside the article panel when dense */}
      {activeTypeData?.categories && (
        <div className={hasDenseCategories ? styles.denseBody : undefined}>
          <div
            className={`${styles.row} ${styles.categoriesRow} ${
              hasDenseCategories ? styles.categoriesRowDense : ""
            }`}
          >
            {activeTypeData.categories.map((category) => (
              <div
                key={category.label}
                className={`${styles.categoryItem} ${
                  panelCategory?.label === category.label && hasDenseCategories
                    ? styles.active
                    : activeCategory === category.label
                      ? styles.active
                      : ""
                }`}
                onMouseEnter={() => handleCategoryHover(category.label)}
              >
                {category.href ? (
                  <Link href={category.href} className={styles.categoryLabel}>
                    {category.label}
                    {category.articles && category.articles.length > 0 && (
                      <span className={styles.arrow}>▶</span>
                    )}
                  </Link>
                ) : (
                  <span className={styles.categoryLabel}>
                    {category.label}
                    {category.articles && category.articles.length > 0 && (
                      <span className={styles.arrow}>▶</span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Article panel beside the dense column */}
          {hasDenseCategories && panelCategory && (
            <div className={styles.panel}>
              <div className={styles.panelTitle}>{panelCategory.label}</div>
              {panelCategory.articles.map((article, idx) => (
                <Link
                  key={`${article.label}-${idx}`}
                  href={article.href}
                  className={`${styles.panelLink} ${isActive(article.href) ? styles.active : ""}`}
                >
                  {article.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Row 3: Articles (Vertical List) - Shows when hovering a category in a horizontal menu */}
      {!hasDenseCategories && activeCategoryData && (
        <div className={`${styles.articlesRow}`}>
          {activeCategoryData.articles.map((article, idx) => (
            <Link
              key={`${article.label}-${idx}`}
              href={article.href}
              className={`${styles.articleLink} ${isActive(article.href) ? styles.active : ""}`}
            >
              • {article.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
