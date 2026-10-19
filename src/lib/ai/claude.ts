/**
 * Claude client (server only).
 *
 * Auth modes, chosen once per process:
 *   - `wif`: Anthropic Workload Identity Federation. The Vercel OIDC token for the
 *     current request (or VERCEL_OIDC_TOKEN) is exchanged for a short-lived Anthropic
 *     token. No API key is stored anywhere. This is the production mode.
 *   - `api_key`: ANTHROPIC_API_KEY, for local development only.
 *
 * Selection order:
 *   1. On a Vercel production deployment with the federation IDs set: `wif`. Any
 *      ANTHROPIC_API_KEY there is ignored (and logged as a warning), because the SDK
 *      would otherwise let it shadow federation.
 *   2. ANTHROPIC_API_KEY set: `api_key`.
 *   3. Federation IDs set and a Vercel OIDC token source present: `wif`.
 *   4. Otherwise: throw a clear configuration error.
 *
 * Never log tokens. Only the mode name is logged.
 */
import Anthropic from '@anthropic-ai/sdk';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import { getVercelOidcToken } from '@vercel/oidc';

export type ClaudeAuthMode = 'wif' | 'api_key';

/**
 * Model tiers. Every call site picks one explicitly.
 *   deep     - long-form synthesis of a user's whole journey (final briefings / deliverables)
 *   standard - per-step insights, followups, the Perception Read paragraph, campaign copy,
 *              admin studio drafting
 *   light    - extraction, classification, short JSON and other small utilities
 */
export type AITier = 'deep' | 'standard' | 'light';

export const DEFAULT_TIER_MODELS: Record<AITier, string> = {
  deep: 'claude-opus-5-5',
  standard: 'claude-sonnet-5-5',
  light: 'claude-haiku-5-5',
};

const TIER_ENV: Record<AITier, string> = {
  deep: 'CLAUDE_MODEL_DEEP',
  standard: 'CLAUDE_MODEL_STANDARD',
  light: 'CLAUDE_MODEL_LIGHT',
};

/** The Claude model for a tier: env override (CLAUDE_MODEL_DEEP / _STANDARD / _LIGHT) or the default. */
export function claudeModel(tier: AITier): string {
  return process.env[TIER_ENV[tier]]?.trim() || DEFAULT_TIER_MODELS[tier];
}

export function claudeModels(): Record<AITier, string> {
  return { deep: claudeModel('deep'), standard: claudeModel('standard'), light: claudeModel('light') };
}

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export class ClaudeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeConfigError';
  }
}

interface FederationIds {
  federationRuleId: string;
  organizationId: string;
  serviceAccountId: string;
  workspaceId?: string;
}

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function federationIds(): FederationIds | null {
  const federationRuleId = readEnv('ANTHROPIC_FEDERATION_RULE_ID');
  const organizationId = readEnv('ANTHROPIC_ORGANIZATION_ID');
  const serviceAccountId = readEnv('ANTHROPIC_SERVICE_ACCOUNT_ID');
  if (!federationRuleId || !organizationId || !serviceAccountId) return null;
  return { federationRuleId, organizationId, serviceAccountId, workspaceId: readEnv('ANTHROPIC_WORKSPACE_ID') };
}

function onVercel(): boolean {
  return process.env.VERCEL === '1';
}

function vercelOidcAvailable(): boolean {
  return onVercel() || !!readEnv('VERCEL_OIDC_TOKEN') || !!readEnv('VERCEL_OIDC_TOKEN_FILE');
}

/** Which auth mode the current environment selects. Throws ClaudeConfigError if none. */
export function resolveClaudeAuthMode(): ClaudeAuthMode {
  const ids = federationIds();
  const isVercelProduction = onVercel() && process.env.VERCEL_ENV === 'production';
  if (ids && isVercelProduction) return 'wif';
  if (readEnv('ANTHROPIC_API_KEY')) return 'api_key';
  if (ids && vercelOidcAvailable()) return 'wif';
  throw new ClaudeConfigError(
    'Claude is not configured. Production needs ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID, ' +
      'ANTHROPIC_SERVICE_ACCOUNT_ID (and ANTHROPIC_WORKSPACE_ID) with Vercel OIDC enabled. ' +
      'Local development can set ANTHROPIC_API_KEY instead.',
  );
}

let cached: { client: Anthropic; mode: ClaudeAuthMode } | null = null;

function build(): { client: Anthropic; mode: ClaudeAuthMode } {
  const mode = resolveClaudeAuthMode();

  if (mode === 'wif') {
    const ids = federationIds()!;
    if (readEnv('ANTHROPIC_API_KEY')) {
      console.warn('[ai/claude] ANTHROPIC_API_KEY is set but ignored: this deployment authenticates with workload identity federation. Remove the key from this environment.');
    }
    const client = new Anthropic({
      // Explicit nulls stop the SDK reading ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
      // from the environment, which would otherwise take precedence over `credentials`.
      apiKey: null,
      authToken: null,
      // The client wraps this provider in a TokenCache (refresh 120s/30s before expiry).
      // Each exchange calls identityTokenProvider, which reads the Vercel OIDC token
      // fresh from the current request context / environment.
      credentials: oidcFederationProvider({
        identityTokenProvider: () => getVercelOidcToken(),
        federationRuleId: ids.federationRuleId,
        organizationId: ids.organizationId,
        serviceAccountId: ids.serviceAccountId,
        workspaceId: ids.workspaceId,
        baseURL: ANTHROPIC_BASE_URL,
        fetch,
      }),
    });
    console.log('[ai/claude] auth mode: wif (Vercel OIDC federation)');
    return { client, mode };
  }

  const client = new Anthropic({ apiKey: readEnv('ANTHROPIC_API_KEY')! });
  console.log('[ai/claude] auth mode: api_key (local development)');
  return { client, mode };
}

/** Lazily constructed singleton. Throws ClaudeConfigError if no auth is configured. */
export function getClaude(): Anthropic {
  if (!cached) cached = build();
  return cached.client;
}

/** The auth mode of the singleton (constructing it if needed). */
export function getClaudeAuthMode(): ClaudeAuthMode {
  if (!cached) cached = build();
  return cached.mode;
}

/** Strip anything token-shaped (Anthropic tokens, JWTs) from a message before logging or returning it. */
export function scrubSecrets(message: string): string {
  return message
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[redacted-jwt]')
    .slice(0, 500);
}

/** Test hook: drop the singleton so the next call re-reads the environment. */
export function resetClaudeClientForTests(): void {
  cached = null;
}
