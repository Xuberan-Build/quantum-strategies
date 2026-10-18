import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { MDXRemote } from "next-mdx-remote/rsc";
import { proseComponents } from "@/components/content/proseComponents";
import styles from "./whitepaper.module.css";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function getAllWhitepapers() {
  const whitepapersDir = path.join(process.cwd(), "src/content/whitepapers");
  if (!fs.existsSync(whitepapersDir)) {
    return [];
  }

  const files = fs.readdirSync(whitepapersDir).filter((file) => file.endsWith(".mdx"));

  return files.map((file) => ({
    slug: file.replace(".mdx", ""),
    filePath: path.join(whitepapersDir, file),
  }));
}

export async function generateStaticParams() {
  return getAllWhitepapers().map((paper) => ({ slug: paper.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const paper = getAllWhitepapers().find((p) => p.slug === slug);

  if (!paper || !fs.existsSync(paper.filePath)) {
    return { title: "Not Found" };
  }

  const fileContent = fs.readFileSync(paper.filePath, "utf-8");
  const { data } = matter(fileContent);

  return {
    title: `${data.title} | Quantum Strategies`,
    description: data.description,
    alternates: {
      canonical: `https://quantumstrategies.online/whitepapers/${slug}/`,
    },
  };
}

export default async function WhitepaperPage({ params }: PageProps) {
  const { slug } = await params;
  const paper = getAllWhitepapers().find((p) => p.slug === slug);

  if (!paper || !fs.existsSync(paper.filePath)) {
    notFound();
  }

  const fileContent = fs.readFileSync(paper.filePath, "utf-8");
  const { data, content } = matter(fileContent);

  return (
    <article className={styles.article}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>White Paper</p>
        <h1 className={styles.title}>{data.title}</h1>
        {data.description && <p className={styles.description}>{data.description}</p>}
        <div className={styles.meta}>
          {data.author && <span>{data.author}</span>}
          {data.date && (
            <time>
              {new Date(data.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
        </div>
      </header>

      <div className={`article-prose ${styles.prose}`}>
        <MDXRemote source={content} components={proseComponents} />
      </div>
    </article>
  );
}
