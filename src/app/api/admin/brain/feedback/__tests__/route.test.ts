import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({ validateAdminApiRequest: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { GET, POST } from '../route';
import { DELETE, PATCH } from '../[id]/route';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const ADMIN = { id: '9c1d2e3f-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };
const ROW_ID = '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a';

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/brain/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const params = (id = ROW_ID) => ({ params: Promise.resolve({ id }) });

describe('/api/admin/brain/feedback', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
  });

  it('401s every method without an admin session, before touching the table', async () => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: null, error: 'Not authenticated' });
    const patchReq = new NextRequest(`http://localhost/api/admin/brain/feedback/${ROW_ID}`, { method: 'PATCH', body: '{"status":"applied"}' });
    const responses = await Promise.all([
      GET(new NextRequest('http://localhost/api/admin/brain/feedback?target_type=deck&target_id=d1')),
      POST(post({ target_type: 'deck', target_id: 'd1', kind: 'agree', body: 'x' })),
      PATCH(patchReq, params()),
      DELETE(new NextRequest(`http://localhost/api/admin/brain/feedback/${ROW_ID}`, { method: 'DELETE' }), params()),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400s invalid input', async () => {
    expect((await POST(post('not json'))).status).toBe(400);
    expect((await POST(post({ target_type: 'deck', target_id: 'd1', kind: 'love', body: 'x' }))).status).toBe(400);
    expect((await POST(post({ target_type: 'slide', target_id: 'd1', kind: 'agree', body: 'x' }))).status).toBe(400);
    expect((await GET(new NextRequest('http://localhost/api/admin/brain/feedback?target_type=user&target_id=x'))).status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('inserts with the admin as author', async () => {
    const insert = vi.fn((row: Record<string, unknown>) => ({
      select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: ROW_ID, ...row }, error: null })) })),
    }));
    vi.mocked(supabaseAdmin.from).mockReturnValue({ insert } as never);
    const res = await POST(post({ target_type: 'slide', target_id: 'd1', slide_id: 's3', kind: 'change', body: 'Tighten this.' }));
    expect(res.status).toBe(201);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('brain_feedback');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: ADMIN.id, target_type: 'slide', target_id: 'd1', deck_id: 'd1', slide_id: 's3', kind: 'change', body: 'Tighten this.' }),
    );
  });

  it('PATCH rejects a bad id and sets reply + status', async () => {
    const bad = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: '{"status":"applied"}' }), params('nope'));
    expect(bad.status).toBe(400);

    const update = vi.fn((patch: Record<string, unknown>) => ({
      eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: ROW_ID, ...patch }, error: null })) })) })),
    }));
    vi.mocked(supabaseAdmin.from).mockReturnValue({ update } as never);
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ status: 'answered', reply: 'Because.' }) }), params());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'answered', reply: 'Because.' }));
  });
});
