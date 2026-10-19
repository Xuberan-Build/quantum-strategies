import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const AnthropicCtor = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    opts: unknown;
    constructor(opts: unknown) {
      AnthropicCtor(opts);
      this.opts = opts;
    }
  },
}));

const oidcFederationProvider = vi.fn((config: unknown) => ({ __provider: true, config }));
vi.mock('@anthropic-ai/sdk/lib/credentials/oidc-federation', () => ({
  oidcFederationProvider: (config: unknown) => oidcFederationProvider(config),
}));

const getVercelOidcToken = vi.fn(() => Promise.resolve('vercel-jwt'));
vi.mock('@vercel/oidc', () => ({ getVercelOidcToken: () => getVercelOidcToken() }));

import {
  claudeModel,
  claudeModels,
  ClaudeConfigError,
  getClaude,
  getClaudeAuthMode,
  resetClaudeClientForTests,
  resolveClaudeAuthMode,
  scrubSecrets,
} from '../claude';

const KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
  'ANTHROPIC_SERVICE_ACCOUNT_ID',
  'ANTHROPIC_WORKSPACE_ID',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_OIDC_TOKEN',
  'VERCEL_OIDC_TOKEN_FILE',
  'CLAUDE_MODEL_DEEP',
  'CLAUDE_MODEL_STANDARD',
  'CLAUDE_MODEL_LIGHT',
];
const saved: Record<string, string | undefined> = {};

function setFederation() {
  process.env.ANTHROPIC_FEDERATION_RULE_ID = 'fdrl_test';
  process.env.ANTHROPIC_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000000';
  process.env.ANTHROPIC_SERVICE_ACCOUNT_ID = 'svac_test';
  process.env.ANTHROPIC_WORKSPACE_ID = 'wrkspc_test';
}

describe('Claude client auth-mode selection', () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetClaudeClientForTests();
    AnthropicCtor.mockClear();
    oidcFederationProvider.mockClear();
    getVercelOidcToken.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  it('throws a clear error when nothing is configured', () => {
    expect(() => resolveClaudeAuthMode()).toThrow(ClaudeConfigError);
    expect(() => getClaude()).toThrow(/ANTHROPIC_FEDERATION_RULE_ID/);
  });

  it('uses WIF on Vercel production, with the Vercel OIDC token provider', async () => {
    setFederation();
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';
    getClaude();
    expect(getClaudeAuthMode()).toBe('wif');
    expect(AnthropicCtor).toHaveBeenCalledTimes(1);
    const opts = AnthropicCtor.mock.calls[0][0];
    expect(opts.apiKey).toBeNull();
    expect(opts.authToken).toBeNull();
    expect(opts.credentials).toMatchObject({ __provider: true });

    const config = oidcFederationProvider.mock.calls[0][0] as Record<string, unknown>;
    expect(config).toMatchObject({
      federationRuleId: 'fdrl_test',
      organizationId: '00000000-0000-0000-0000-000000000000',
      serviceAccountId: 'svac_test',
      workspaceId: 'wrkspc_test',
      baseURL: 'https://api.anthropic.com',
    });
    expect(typeof config.fetch).toBe('function');
    // The identity token is fetched fresh on every exchange.
    const provider = config.identityTokenProvider as () => Promise<string>;
    await provider();
    await provider();
    expect(getVercelOidcToken).toHaveBeenCalledTimes(2);
  });

  it('ignores ANTHROPIC_API_KEY on Vercel production and warns', () => {
    setFederation();
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-should-not-be-used';
    expect(getClaudeAuthMode()).toBe('wif');
    expect(AnthropicCtor.mock.calls[0][0].apiKey).toBeNull();
    expect(console.warn).toHaveBeenCalled();
    const logged = JSON.stringify([...(console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls, ...(console.log as unknown as { mock: { calls: unknown[] } }).mock.calls]);
    expect(logged).not.toContain('sk-ant-should-not-be-used');
  });

  it('uses the API key locally', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-local';
    expect(getClaudeAuthMode()).toBe('api_key');
    expect(AnthropicCtor.mock.calls[0][0]).toEqual({ apiKey: 'sk-ant-local' });
    expect(oidcFederationProvider).not.toHaveBeenCalled();
    expect(JSON.stringify((console.log as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain('sk-ant-local');
  });

  it('prefers a local API key over federation outside Vercel production', () => {
    setFederation();
    process.env.VERCEL_OIDC_TOKEN = 'pulled-token';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-local';
    expect(resolveClaudeAuthMode()).toBe('api_key');
  });

  it('uses WIF locally when federation IDs and a Vercel OIDC token are present without a key', () => {
    setFederation();
    process.env.VERCEL_OIDC_TOKEN = 'pulled-token';
    expect(resolveClaudeAuthMode()).toBe('wif');
  });

  it('does not select WIF without a Vercel OIDC source', () => {
    setFederation();
    expect(() => resolveClaudeAuthMode()).toThrow(ClaudeConfigError);
  });

  it('constructs the client once (lazy singleton)', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-local';
    const a = getClaude();
    const b = getClaude();
    expect(a).toBe(b);
    expect(AnthropicCtor).toHaveBeenCalledTimes(1);
  });

  it('tier models default to Opus / Sonnet / Haiku 5.x and honour per-tier env overrides', () => {
    expect(claudeModels()).toEqual({ deep: 'claude-opus-5-5', standard: 'claude-sonnet-5-5', light: 'claude-haiku-5-5' });
    process.env.CLAUDE_MODEL_DEEP = 'claude-fable-5-1';
    process.env.CLAUDE_MODEL_STANDARD = 'claude-opus-5-5';
    process.env.CLAUDE_MODEL_LIGHT = 'claude-haiku-4-5';
    expect(claudeModel('deep')).toBe('claude-fable-5-1');
    expect(claudeModel('standard')).toBe('claude-opus-5-5');
    expect(claudeModel('light')).toBe('claude-haiku-4-5');
  });

  it('scrubSecrets removes token-shaped strings', () => {
    const msg = scrubSecrets('bad sk-ant-oat01-abc_DEF and eyJhbGciOi.eyJzdWIiOi.sig-123 here');
    expect(msg).toBe('bad [redacted] and [redacted-jwt] here');
  });
});
