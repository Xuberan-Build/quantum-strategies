/**
 * Daily paid-but-no-access check (see src/lib/billing/reconcile.ts).
 * Reads Stripe and the database, never grants. Emails the admins when a paid
 * session left no record, so a human can fix it before the customer writes in.
 *
 * Local: curl http://localhost:3000/api/cron/reconcile-payments -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { reconcilePayments } from '@/lib/billing/reconcile';
import { sendAdminNotification } from '@/lib/stripe/webhook-handlers/send-welcome-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  try {
    const stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
    const report = await reconcilePayments(stripe, 48);

    for (const gap of report.gaps) {
      try {
        await sendAdminNotification({
          customerEmail: gap.email ?? 'unknown',
          customerName: 'PAYMENT CHECK',
          productName: `PAID BUT NO ACCESS (${gap.reason}) for ${gap.productSlug ?? 'unknown product'}, fix by hand`,
          amount: gap.amount,
          sessionId: gap.sessionId,
        });
      } catch (err: any) {
        console.error('[reconcile-payments] alert failed:', err?.message);
      }
    }

    console.log('[reconcile-payments] done:', { checked: report.checked, ok: report.ok, gaps: report.gaps.length });
    // Session ids and reasons only; no emails in the response body or logs.
    return NextResponse.json({
      success: true,
      checked: report.checked,
      ok: report.ok,
      gaps: report.gaps.map((g) => ({ sessionId: g.sessionId, reason: g.reason, productSlug: g.productSlug })),
    });
  } catch (err: any) {
    console.error('[reconcile-payments] run failed:', err?.message);
    return NextResponse.json({ error: 'Run failed' }, { status: 500 });
  }
}
