import { NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { claudeModels, getClaude, getClaudeAuthMode, resolveClaudeAuthMode, scrubSecrets } from '@/lib/ai/claude';
import { aiProvider } from '@/lib/ai/generate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ai/health
 * Admin only. Makes one tiny call on the light tier to prove auth (workload identity
 * federation in production) works. Returns { provider, authMode, model, models, ok, latencyMs }
 * where `model` is the pinged light-tier model and `models` lists all three resolved tiers.
 * Never returns token contents.
 */
export async function GET() {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (authError || !admin) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: authError === 'Not authenticated' ? 401 : 403 },
    );
  }

  const provider = aiProvider();
  const models = claudeModels();
  const model = models.light;
  let authMode: string | null = null;
  const started = Date.now();
  try {
    authMode = resolveClaudeAuthMode();
    const client = getClaude();
    authMode = getClaudeAuthMode();
    const message = await client.messages.create(
      {
        model,
        max_tokens: 20,
        output_config: { effort: 'low' },
        // Haiku 5.5 accepts thinking off at effort low; other models keep adaptive thinking.
        ...(/haiku/i.test(model) ? { thinking: { type: 'disabled' as const } } : {}),
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      },
      { maxRetries: 0, timeout: 30_000 },
    );
    return NextResponse.json({
      provider,
      authMode,
      model,
      models,
      ok: true,
      latencyMs: Date.now() - started,
      stopReason: message.stop_reason,
    });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? null;
    const name = err instanceof Error ? err.name : 'Error';
    const message = err instanceof Error ? scrubSecrets(err.message) : 'Unknown error';
    return NextResponse.json(
      { provider, authMode, model, models, ok: false, latencyMs: Date.now() - started, error: { name, status, message } },
      { status: 502 },
    );
  }
}
