import { NextResponse } from "next/server";
import { isReadLive } from "@/lib/read/live";

// isReadLive (src/lib/read/live.ts) caches the lookup for 5 minutes; this response adds 60s.
export const revalidate = 60;

/** GET /api/read/live → { live: boolean }. For client components that gate Read CTAs. */
export async function GET() {
  const live = await isReadLive();
  return NextResponse.json(
    { live },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
