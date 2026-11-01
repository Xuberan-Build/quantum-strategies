"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./hero.module.css";

type Props = {
  onOpenResume: () => void;
  onOpenPortfolio: () => void;
  /** Secondary line under the buttons (the Perception Read, when live). Server-rendered. */
  readCta?: React.ReactNode;
};

export default function Hero({ onOpenResume, onOpenPortfolio, readCta }: Props) {
  const [navH, setNavH] = useState(0);
  const rafId = useRef<number | null>(null);
  const t0 = useRef<number | null>(null);
  const shipRef = useRef<HTMLImageElement>(null);

  // Track navigation height for hero min-height calculation
  useEffect(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]') as HTMLElement | null;
    const read = () => setNavH(nav?.offsetHeight ?? 0);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Ship animation: scroll-based arc + floating bob
  useEffect(() => {
    const step = (now: number) => {
      if (t0.current == null) t0.current = now;
      const t = (now - t0.current) / 1000;

      const vh = window.innerHeight || 1;
      const progressRaw = window.scrollY / (vh * 0.9);
      const p = Math.max(0, Math.min(1, progressRaw));

      const x = easeOutCubic(p) * 80;
      const yArc = -22 * Math.sin(p * Math.PI);
      const yBob = -6 * Math.sin(t * 2.2);

      if (shipRef.current) {
        shipRef.current.style.transform = `translate3d(${x}px, ${yArc + yBob}px, 0)`;
      }

      rafId.current = requestAnimationFrame(step);
    };

    rafId.current = requestAnimationFrame(step);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <section
      aria-labelledby="hero-heading"
      className={styles.hero}
      style={{ "--nav-height": `${navH}px` } as React.CSSProperties}
    >
      <div className={styles.heroContent}>
        <div className={styles.shipWrapper}>
          <Image
            ref={shipRef}
            src="/images/hero-ship.webp"
            alt="Futuristic spaceship representing innovative marketing strategies"
            className={styles.ship}
            priority
            width={500}
            height={333}
            sizes="(min-width: 900px) 520px, 90vw"
          />
        </div>

        <div className={styles.textContent}>
          <h1 id="hero-heading" className={styles.heading}>
            Mastering The Art of Creating &amp; Adding Value
          </h1>
          <p className={styles.tagline}>Co-Creating Asset Vehicles for Scalable Growth.</p>

          <div className={styles.buttonRow}>
            <button
              className="btn right-btn"
              aria-label="View portfolio of marketing projects"
              onClick={onOpenPortfolio}
            >
              See Portfolio
            </button>

            <button
              className="btn left-btn"
              aria-label="View professional experience"
              onClick={onOpenResume}
            >
              See Experience
            </button>
          </div>
          {readCta}
        </div>
      </div>

      <div className={styles.backgroundGlow} aria-hidden="true" />
    </section>
  );
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
