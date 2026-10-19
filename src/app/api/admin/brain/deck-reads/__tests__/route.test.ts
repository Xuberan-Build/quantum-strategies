import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({ validateAdminApiRequest: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { GET, POST } from '../route';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const ADMIN = { id: '9c1d2e3f-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/brain/deck-reads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

/** Chainable select mock: from().select().eq().eq?().limit().returns() */
function selectChain(result: { data: unknown; error: unknown }) {
  const eq = vi.fn();
  const chain = {
    eq,
    limit: vi.fn(() => ({ returns: vi.fn(async () => result) })),
  };
  eq.mockImplementation(() => chain);
  const select = vi.fn(() => chain);
  return { select, eq };
}

describe('/api/admin/brain/deck-reads', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
  });

  it('401s without an admin session, before touching the table', async () => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: null, error: 'Not authenticated' });
    const res = await Promise.all([GET(new NextRequest('http://localhost/api/admin/brain/deck-reads')), POST(post({ deck_id: 'd1', read: false }))]);
    expect(res.map((r) => r.status)).toEqual([401, 401]);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400s invalid input', async () => {
    expect((await POST(post('not json'))).status).toBe(400);
    expect((await POST(post({ deck_id: 'd1' }))).status).toBe(400);
    expect((await POST(post({ deck_id: 'd1', read: true }))).status).toBe(400); // no content_hash
    expect((await POST(post({ deck_id: '../etc', read: false }))).status).toBe(400);
    expect((await GET(new NextRequest('http://localhost/api/admin/brain/deck-reads?deck_id=../x'))).status).toBe(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('GET lists only the signed-in admin’s receipts', async () => {
    const rows = [{ id: 'r1', user_id: ADMIN.id, deck_id: 'd1', content_hash: 'c1-x', read_at: '2000-01-01T00:00:00Z', last_slide: 3 }];
    const { select, eq } = selectChain({ data: rows, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ select } as never);
    const res = await GET(new NextRequest('http://localhost/api/admin/brain/deck-reads?deck_id=d1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows });
    expect(supabaseAdmin.from).toHaveBeenCalledWith('brain_deck_reads');
    expect(eq).toHaveBeenCalledWith('user_id', ADMIN.id);
    expect(eq).toHaveBeenCalledWith('deck_id', 'd1');
  });

  it('GET 500s when the table is unavailable', async () => {
    const { select } = selectChain({ data: null, error: { message: 'relation "brain_deck_reads" does not exist' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ select } as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await GET(new NextRequest('http://localhost/api/admin/brain/deck-reads'))).status).toBe(500);
  });

  it('POST upserts on (user, deck) and marks read with the content hash', async () => {
    const upsert = vi.fn((row: Record<string, unknown>) => ({
      select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'r1', last_slide: 0, ...row }, error: null })) })),
    }));
    vi.mocked(supabaseAdmin.from).mockReturnValue({ upsert } as never);
    const res = await POST(post({ deck_id: 'd1', read: true, content_hash: 'c1-abc', last_slide: 5 }));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ADMIN.id, deck_id: 'd1', content_hash: 'c1-abc', last_slide: 5, read_at: expect.any(String) }),
      { onConflict: 'user_id,deck_id' },
    );
    const json = (await res.json()) as { row: { read_at: string } };
    expect(json.row.read_at).toEqual(expect.any(String));
  });

  it('POST mark unread clears read_at and a progress update leaves it alone', async () => {
    const upsert = vi.fn((row: Record<string, unknown>) => ({
      select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'r1', ...row }, error: null })) })),
    }));
    vi.mocked(supabaseAdmin.from).mockReturnValue({ upsert } as never);
    await POST(post({ deck_id: 'd1', read: false }));
    expect(upsert.mock.calls[0][0]).toMatchObject({ read_at: null });
    await POST(post({ deck_id: 'd1', last_slide: 2 }));
    expect(upsert.mock.calls[1][0]).toEqual(expect.objectContaining({ last_slide: 2 }));
    expect(upsert.mock.calls[1][0]).not.toHaveProperty('read_at');
  });

  it('POST 500s on a database error', async () => {
    const upsert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { message: 'boom' } })) })) }));
    vi.mocked(supabaseAdmin.from).mockReturnValue({ upsert } as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await POST(post({ deck_id: 'd1', read: false }))).status).toBe(500);
  });
});
