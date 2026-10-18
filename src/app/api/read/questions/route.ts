import { NextRequest, NextResponse } from 'next/server';
import { visibleQuestions } from '@/lib/read/questions';
import type { Segment } from '@/lib/read/types';
import { limit } from '../_lib/http';
import { SEGMENTS } from '../_lib/validate';

/**
 * GET /api/read/questions?segment=&variant= → { questions: ReadQuestion[] }
 * Served from code (READ_QUESTIONS, the same list seeded into product_definitions.steps).
 */
export async function GET(req: NextRequest) {
  const limited = limit(req, 'questions');
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;
  const segRaw = sp.get('segment');
  const segment = segRaw && (SEGMENTS as string[]).includes(segRaw) ? (segRaw as Segment) : null;
  const varRaw = sp.get('variant');
  const variant = varRaw && /^[a-z0-9_-]{1,40}$/i.test(varRaw) ? varRaw : null;

  return NextResponse.json(
    { questions: visibleQuestions(segment, variant) },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
  );
}
