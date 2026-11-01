import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { isReadLive } from "@/lib/read/live";
import { LANDING } from "./copy";
import styles from "./ReadCta.module.css";

export interface ReadCtaProps {
  /** utm_source for this placement, e.g. "rite-system" or "home". */
  utmSource: string;
  /**
   * utm_content. The Read landing page picks its opening line from this
   * (see LANDING_LINES in ./copy); unknown values get the default line.
   */
  utmContent?: string;
  /** utm_term, e.g. the position on the page ("top", "end"). */
  utmTerm?: string;
  /** utm_campaign. Defaults to "read-cta". */
  utmCampaign?: string;
  /** One-line banner instead of the full card. */
  compact?: boolean;
  /** Rendered instead when the Read is switched off (e.g. the existing beta CTA). */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Blue call to action for the free Perception Read. Follows the one switch
 * (product_definitions.is_active via isReadLive): while the Read is off it renders
 * `fallback`, or nothing.
 */
export default async function ReadCta({
  utmSource,
  utmContent = "read",
  utmTerm,
  utmCampaign = "read-cta",
  compact = false,
  fallback = null,
  className,
  style,
}: ReadCtaProps) {
  if (!(await isReadLive())) return <>{fallback}</>;

  const params = new URLSearchParams({
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
  });
  if (utmTerm) params.set("utm_term", utmTerm);
  const href = `/read/?${params.toString()}`;
  const classes = [styles.cta, compact ? styles.compact : "", className ?? ""].filter(Boolean).join(" ");

  if (compact) {
    return (
      <aside className={classes} style={style} aria-label="Take the Perception Read">
        <p className={styles.compactText}>
          <strong className={styles.compactName}>{LANDING.name}</strong>
          <span className={styles.compactFacts}>{LANDING.facts.slice(0, 3).join(" · ")}</span>
        </p>
        <Link href={href} className={styles.button}>
          Take the free Read →
        </Link>
      </aside>
    );
  }

  return (
    <aside className={classes} style={style} aria-label="Take the Perception Read">
      <p className={styles.eyebrow}>Free · about 5 minutes</p>
      <h2 className={styles.title}>See what your attention is set to</h2>
      <p className={styles.body}>
        Twelve questions about what you did and said this month. The Perception Read shows the pattern your answers
        keep repeating. It&apos;s a reflection tool, not a diagnosis.
      </p>
      <Link href={href} className={styles.button}>
        Take the free Read →
      </Link>
    </aside>
  );
}
