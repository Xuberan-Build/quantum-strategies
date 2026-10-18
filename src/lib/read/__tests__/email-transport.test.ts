import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deliverReadEmail, getReadEmailMode } from '../email-transport';

const msg = { to: 'sam@example.test', subject: 'Your Perception Read: Running on shoulds', html: '<p>hi</p>', text: 'hi', kind: 'r1' };
const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe('deliverReadEmail', () => {
  it('defaults to preview outside production', () => {
    delete process.env.READ_EMAIL_MODE;
    expect(getReadEmailMode()).toBe('preview');
  });

  it('preview mode writes html, txt and json to the preview folder and sends nothing', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'read-email-'));
    process.env.READ_EMAIL_MODE = 'preview';
    process.env.READ_EMAIL_PREVIEW_DIR = dir;
    const out = await deliverReadEmail({ ...msg, listUnsubscribeUrl: 'https://app.example.test/api/read/email/unsubscribe?t=x' });
    expect(out).toMatchObject({ ok: true, mode: 'preview' });
    const files = readdirSync(dir);
    expect(files.filter((f) => f.endsWith('.html'))).toHaveLength(1);
    expect(files.some((f) => f.includes('sam@'))).toBe(false);
    const txt = readFileSync(path.join(dir, files.find((f) => f.endsWith('.txt'))!), 'utf8');
    expect(txt).toContain('Subject: Your Perception Read: Running on shoulds');
  });

  it('send mode with no sender configured fails softly (logged, no throw)', async () => {
    process.env.READ_EMAIL_MODE = 'send';
    const out = await deliverReadEmail(msg);
    expect(out.ok).toBe(false);
    expect(out.error).toBeTruthy();
  });

  it('off mode sends nothing', async () => {
    process.env.READ_EMAIL_MODE = 'off';
    expect(await deliverReadEmail(msg)).toMatchObject({ ok: false, mode: 'off' });
  });
});
