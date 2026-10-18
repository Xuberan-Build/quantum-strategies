import Link from "next/link";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { portfolioCases } from "@/lib/constants/portfolio";
import { isPublicSlug } from "@/lib/seo/sitemap";
import styles from "./resources.module.css";

export const metadata = {
  title: "Resources | Quantum Strategies",
  description: "Strategic frameworks, courses, and insights to accelerate your business growth. Articles, white papers, and actionable courses.",
  alternates: {
    canonical: "https://quantumstrategies.online/resources/",
  },
};

function getFeaturedArticles() {
  const articlesDir = path.join(process.cwd(), "src/content/articles");
  const categories = ["customer-acquisition", "operations", "product-development"];

  const articles: any[] = [];

  categories.forEach((category) => {
    const categoryDir = path.join(articlesDir, category);
    if (fs.existsSync(categoryDir)) {
      const files = fs
        .readdirSync(categoryDir)
        .filter((file) => file.endsWith(".mdx") && isPublicSlug(file.replace(".mdx", "")));

      // Get first 2 articles from each category
      files.slice(0, 2).forEach((file) => {
        const filePath = path.join(categoryDir, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const { data } = matter(fileContent);

        articles.push({
          slug: file.replace(".mdx", ""),
          category: category.replace(/-/g, " "),
          title: data.title || file.replace(".mdx", ""),
          description: data.description || ""
        });
      });
    }
  });

  return articles;
}

export default function ResourcesHub() {
  const featuredArticles = getFeaturedArticles();
  const whitepapersDir = path.join(process.cwd(), "src/content/whitepapers");
  const whitepaperCount = fs.existsSync(whitepapersDir)
    ? fs.readdirSync(whitepapersDir).filter((file) => file.endsWith(".mdx")).length
    : 0;

  const contentTypes = [
    {
      title: "Articles",
      description: "In-depth guides on customer acquisition, product development, and operations",
      href: "/articles",
      icon: "📚",
      count: `${featuredArticles.length}+ articles`
    },
    {
      title: "Courses",
      description: "Structured learning experiences with interactive content and proven frameworks",
      href: "/courses",
      icon: "🎓",
      count: "Preview available"
    },
    {
      title: "White Papers",
      description: "Comprehensive research and strategic frameworks for business growth",
      href: "/whitepapers",
      icon: "📄",
      count: whitepaperCount > 0 ? `${whitepaperCount} available` : "New release pending"
    },
    {
      title: "Case Studies",
      description: "Real-world transformations and performance outcomes across industries",
      href: "/portfolio",
      icon: "📈",
      count: `${portfolioCases.length} case studies`
    }
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={`${styles.heroContent} container`}>
          <h1 className={styles.heroTitle}>Resources Hub</h1>
          <p className={styles.heroSubtitle}>
            Strategic frameworks and actionable insights to accelerate your business growth
          </p>
        </div>
      </header>

      <section className={`${styles.section} container`}>
        <div className={styles.sectionHeader}>
          <h2>Browse by Type</h2>
          <p>Pick the format that matches your current growth challenge.</p>
        </div>
        <div className={styles.grid}>
          {contentTypes.map((type) => (
            <Link
              key={type.title}
              href={type.href}
              className={styles.card}
            >
              <div className={styles.cardIcon}>{type.icon}</div>
              <h3 className={styles.cardTitle}>{type.title}</h3>
              <p className={styles.cardDescription}>{type.description}</p>
              <div className={styles.cardMeta}>{type.count} -&gt;</div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.section} container`}>
        <div className={styles.sectionHeadingRow}>
          <div>
            <h2>Featured Articles</h2>
            <p>Quick reads with actionable frameworks.</p>
          </div>
          <Link href="/articles/" className={styles.sectionLink}>
            View all articles -&gt;
          </Link>
        </div>

        <div className={styles.articleGrid}>
          {featuredArticles.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}/`}
              className={styles.articleCard}
            >
              <div className={styles.articleCategory}>{article.category}</div>
              <h3 className={styles.articleTitle}>{article.title}</h3>
              <p className={styles.articleDescription}>{article.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.ctaInner} container`}>
          <h2>Ready to Transform Your Business?</h2>
          <p>Get personalized strategic consulting to accelerate your growth.</p>
          <a className={styles.ctaButton} href="mailto:austin.j.santos.93@gmail.com">
            Let's Talk Strategy -&gt;
          </a>
        </div>
      </section>
    </div>
  );
}
