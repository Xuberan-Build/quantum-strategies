"use client";
import { useEffect, useState } from "react";

// One request per page load, shared by the Navbar and MobileMenu.
let readLivePromise: Promise<boolean> | null = null;

function fetchReadLive(): Promise<boolean> {
  if (!readLivePromise) {
    readLivePromise = fetch("/api/read/live", { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`read/live ${res.status}`);
        const data = (await res.json()) as { live?: unknown };
        return data?.live === true;
      })
      .catch(() => {
        // Fail closed, and let a later mount retry.
        readLivePromise = null;
        return false;
      });
  }
  return readLivePromise;
}

/** True only when GET /api/read/live returns { live: true }. False while loading and on any error. */
export function useReadLive(): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchReadLive().then((value) => {
      if (!cancelled) setLive(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return live;
}
