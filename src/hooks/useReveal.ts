"use client";

import { useState, useEffect, useRef } from "react";

type RefCallback = (el: HTMLElement | null) => void;

/**
 * Scroll-reveal hook. Tracks named sections via IntersectionObserver and
 * exposes a setter that returns a ref callback per key.
 *
 * Usage:
 *   const [setRef, isRevealed] = useReveal();
 *   <section ref={setRef("hero")} data-section="hero" />
 *   <div className={`reveal ${isRevealed("hero") ? "visible" : ""}`} />
 */
export function useReveal(
  threshold: number | number[] = 0
): [(key: string) => RefCallback, (key: string) => boolean] {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const refsMap = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = (entry.target as HTMLElement).dataset.section;
            if (!key) return;
            setRevealed((prev) => {
              if (prev.has(key)) return prev;
              const next = new Set(prev);
              next.add(key);
              return next;
            });
          }
        });
      },
      { threshold }
    );

    Object.values(refsMap.current).forEach((el) => {
      if (el && observerRef.current) observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [threshold]);

  const setRef = (key: string): RefCallback => (el) => {
    if (el) {
      el.dataset.section = key;
      refsMap.current[key] = el;
      observerRef.current?.observe(el);
    }
  };

  const isRevealed = (key: string) => revealed.has(key);

  return [setRef, isRevealed];
}
