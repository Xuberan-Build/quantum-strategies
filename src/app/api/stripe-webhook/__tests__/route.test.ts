import { describe, it, expect, vi, beforeEach } from 'vitest';

const constructEvent = vi.fn();
const grantProductAccess = vi.fn();
const sendWelcomeEmail = vi.fn();
const sendAdminNotification = vi.fn();
const processAffiliate = vi.fn();
const syncToCRM = vi.fn();
const enrollInPurchaseCampaigns = vi.fn();
const recordReadPurchase = vi.fn();
const priorRowsResult = vi.fn();

vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent };
    checkout = { sessions: { retrieve: vi.fn() } };
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ limit: () => priorRowsResult() }) }),
    }),
  },
}));
vi.mock('@/lib/stripe/webhook-handlers/grant-access', () => ({ grantProductAccess }));
vi.mock('@/lib/stripe/webhook-handlers/send-welcome-email', () => ({ sendWelcomeEmail, sendAdminNotification }));
vi.mock('@/lib/stripe/webhook-handlers/sync-crm', () => ({ syncToCRM }));
vi.mock('@/lib/stripe/webhook-handlers/process-affiliate', () => ({ processAffiliate }));
vi.mock('@/lib/google-sheets/customer-sync', () => ({ syncCustomer: vi.fn() }));
vi.mock('@/lib/crm/auto-enroll', () => ({ enrollInPurchaseCampaigns }));
const recordInitiationPayment = vi.fn();
vi.mock('@/lib/beta/initiation-server', () => ({ recordInitiationPayment }));
vi.mock('@/lib/read/lead-link', () => ({ recordReadPurchase }));

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
const { POST } = await import('../route');

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    amount_total: 1200,
    customer_details: { email: 'buyer@example.test', name: 'Buyer' },
    metadata: { product_slug: 'perception-rite-bundle' },
    client_reference_id: 'user-1',
    payment_intent: 'pi_1',
    customer: 'cus_1',
    ...overrides,
  };
}

function req() {
  return new Request('https://app.example.test/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig' },
    body: '{}',
  }) as any;
}

describe('POST /api/stripe-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    priorRowsResult.mockResolvedValue({ data: [], error: null });
    grantProductAccess.mockResolvedValue({ userId: 'user-1', productsGranted: ['perception-rite-scan-1'], productAccessIds: ['pa1'] });
    enrollInPurchaseCampaigns.mockResolvedValue(undefined);
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session() } });
  });

  it('grants and runs side effects on a first delivery', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(grantProductAccess).toHaveBeenCalledTimes(1);
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(processAffiliate).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and alerts when the grant fails, so Stripe retries', async () => {
    grantProductAccess.mockRejectedValue(new Error('db down'));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(sendAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ productName: expect.stringContaining('GRANT FAILED') }));
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(processAffiliate).not.toHaveBeenCalled();
  });

  it('re-checks the grant but skips side effects on a replayed session', async () => {
    priorRowsResult.mockResolvedValue({ data: [{ id: 'pa1' }], error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(grantProductAccess).toHaveBeenCalledTimes(1);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(sendAdminNotification).not.toHaveBeenCalled();
    expect(processAffiliate).not.toHaveBeenCalled();
    expect(syncToCRM).not.toHaveBeenCalled();
  });

  it('returns 500 when the replay check cannot run', async () => {
    priorRowsResult.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(grantProductAccess).not.toHaveBeenCalled();
  });

  it('does not grant an unpaid session', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session({ payment_status: 'unpaid' }) } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(grantProductAccess).not.toHaveBeenCalled();
  });

  it('still grants when payment_status is absent (older endpoint API versions)', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session({ payment_status: undefined }) } });
    await POST(req());
    expect(grantProductAccess).toHaveBeenCalledTimes(1);
  });

  it('grants a 100% promo session', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session({ payment_status: 'no_payment_required', amount_total: 0 }) } });
    await POST(req());
    expect(grantProductAccess).toHaveBeenCalledTimes(1);
  });

  it('acknowledges an unknown product with 200 and alerts, instead of a retry loop', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session({ metadata: {}, success_url: 'https://x.test/thanks' }) } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(grantProductAccess).not.toHaveBeenCalled();
    expect(sendAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ productName: expect.stringContaining('UNKNOWN PRODUCT') }));
  });

  it.each([
    [{ product_slug: 'initiation', initiation_credit: '17' }],
    [{ product_slug: 'founding-member', founding_credit: '17' }], // sessions created before the rename
  ])('records an Initiation payment without granting products (%o)', async (metadata) => {
    recordInitiationPayment.mockResolvedValue({ recorded: true });
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session({ metadata }) } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(recordInitiationPayment).toHaveBeenCalledWith(expect.objectContaining({ credit: 17, sessionId: 'cs_test_1' }));
    expect(grantProductAccess).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('rejects a bad signature', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad sig'); });
    const res = await POST(req());
    expect(res.status).toBe(400);
  });
});
