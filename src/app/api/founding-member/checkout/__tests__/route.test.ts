import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const getFoundingOffer = vi.fn();
const sessionsCreate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
  supabaseAdmin: {},
}));
vi.mock('@/lib/beta/founding-member-server', () => ({ getFoundingOffer }));
vi.mock('@/lib/config/urls', () => ({ APP_URL: 'https://app.example.test', MARKETING_URL: '' }));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: sessionsCreate } };
  },
}));

const { POST } = await import('../route');

const req = () => new Request('https://app.example.test/api/founding-member/checkout', { method: 'POST' }) as any;

describe('POST /api/founding-member/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'beta@example.test' } } });
    sessionsCreate.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.example.test' });
  });

  it('requires sign in', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('refuses users who are not beta participants', async () => {
    getFoundingOffer.mockResolvedValue({ participant: null, eligibility: { eligible: false, reason: 'not_beta' }, pricing: null });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('refuses after the deadline and for existing members', async () => {
    getFoundingOffer.mockResolvedValue({ participant: { id: 'p1' }, eligibility: { eligible: false, reason: 'closed' }, pricing: null });
    expect((await POST(req())).status).toBe(410);
    getFoundingOffer.mockResolvedValue({ participant: { id: 'p1' }, eligibility: { eligible: false, reason: 'already_member' }, pricing: null });
    expect((await POST(req())).status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('does not open checkout when prior payments cover the price', async () => {
    getFoundingOffer.mockResolvedValue({
      participant: { id: 'p1' },
      eligibility: { eligible: true },
      pricing: { credit: 60, price: 0, covered: true },
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('charges the server-computed price and tags the session for the webhook', async () => {
    getFoundingOffer.mockResolvedValue({
      participant: { id: 'p1' },
      eligibility: { eligible: true },
      pricing: { credit: 17, price: 43, covered: false },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.line_items[0].price_data.unit_amount).toBe(4300);
    expect(args.metadata).toMatchObject({ product_slug: 'founding-member', founding_credit: '17', beta_participant_id: 'p1' });
    expect(args.client_reference_id).toBe('u1');
    expect(args.allow_promotion_codes).toBe(false);
  });
});
