/**
 * The Perception Read: email delivery. Server-only. Never throws.
 *
 * Modes (READ_EMAIL_MODE):
 *   - send     real delivery (default when NODE_ENV=production)
 *   - preview  write the rendered email to READ_EMAIL_PREVIEW_DIR (default
 *              ./.read-email-previews) instead of sending (default everywhere else)
 *   - off      do nothing, report not sent
 *
 * Transport (READ_EMAIL_TRANSPORT): gmail | resend. Default: Gmail when its
 * service-account credentials are set (same path as the welcome email), else Resend
 * when RESEND_API_KEY is set. A missing sender or credentials is logged and reported
 * as a failed send. Callers decide what that means; unlock must never fail on it.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BUSINESS } from '../../../config/business.config';

export type ReadEmailMode = 'send' | 'preview' | 'off';

export interface OutgoingReadEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** e.g. 'r1', 'day2', 'day7'. Used in preview file names and logs. */
  kind: string;
  /** RFC 8058 one-click URL for the List-Unsubscribe header. */
  listUnsubscribeUrl?: string;
}

export interface ReadEmailOutcome {
  ok: boolean;
  mode: ReadEmailMode;
  transport?: 'gmail' | 'resend';
  id?: string;
  previewPath?: string;
  error?: string;
}

const PLACEHOLDER_SENDER = 'noreply@example.com';

export function getReadEmailMode(): ReadEmailMode {
  const m = process.env.READ_EMAIL_MODE?.trim().toLowerCase();
  if (m === 'send' || m === 'preview' || m === 'off') return m;
  return process.env.NODE_ENV === 'production' ? 'send' : 'preview';
}

export function getPreviewDir(): string {
  return process.env.READ_EMAIL_PREVIEW_DIR?.trim() || path.join(process.cwd(), '.read-email-previews');
}

function gmailCredentials(): { client_email?: string; private_key?: string } {
  const client_email = process.env.GOOGLE_GMAIL_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_GMAIL_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (private_key?.includes('\\n')) private_key = private_key.replace(/\\n/g, '\n');
  return { client_email, private_key };
}

function pickTransport(): 'gmail' | 'resend' | null {
  const forced = process.env.READ_EMAIL_TRANSPORT?.trim().toLowerCase();
  const gmail = gmailCredentials();
  const hasGmail = Boolean(gmail.client_email && gmail.private_key);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (forced === 'gmail') return hasGmail ? 'gmail' : null;
  if (forced === 'resend') return hasResend ? 'resend' : null;
  if (hasGmail) return 'gmail';
  if (hasResend) return 'resend';
  return null;
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Safe file stem: never the whole address in a file name. */
function previewStem(msg: OutgoingReadEmail, now: Date): string {
  const local = msg.to.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'lead';
  return `${now.toISOString().replace(/[:.]/g, '-')}-${msg.kind}-${local}`;
}

async function writePreview(msg: OutgoingReadEmail): Promise<string> {
  const dir = getPreviewDir();
  await fs.mkdir(dir, { recursive: true });
  const stem = previewStem(msg, new Date());
  const meta = {
    to: msg.to,
    subject: msg.subject,
    kind: msg.kind,
    listUnsubscribe: msg.listUnsubscribeUrl ?? null,
  };
  await Promise.all([
    fs.writeFile(path.join(dir, `${stem}.html`), msg.html, 'utf8'),
    fs.writeFile(path.join(dir, `${stem}.txt`), `Subject: ${msg.subject}\n\n${msg.text}`, 'utf8'),
    fs.writeFile(path.join(dir, `${stem}.json`), JSON.stringify(meta, null, 2), 'utf8'),
  ]);
  return path.join(dir, `${stem}.html`);
}

async function sendViaGmail(msg: OutgoingReadEmail, from: { email: string; name: string }): Promise<string> {
  const { google } = await import('googleapis');
  const creds = gmailCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: from.email,
  });
  const gmail = google.gmail({ version: 'v1', auth });
  const boundary = `qs-read-${Date.now().toString(36)}`;
  const raw = [
    `From: "${from.name}" <${from.email}>`,
    `To: ${msg.to}`,
    `Reply-To: ${from.email}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    ...(msg.listUnsubscribeUrl
      ? [`List-Unsubscribe: <${msg.listUnsubscribeUrl}>`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click']
      : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    msg.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    msg.html,
    '',
    `--${boundary}--`,
  ].join('\n');
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  return res.data.id || 'sent';
}

async function sendViaResend(msg: OutgoingReadEmail, from: { email: string; name: string }): Promise<string> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${from.name} <${from.email}>`,
    to: [msg.to],
    replyTo: from.email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    ...(msg.listUnsubscribeUrl && {
      headers: {
        'List-Unsubscribe': `<${msg.listUnsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
  return data?.id || 'sent';
}

/** Delivers or previews one email. Logs and returns failures; never throws. */
export async function deliverReadEmail(msg: OutgoingReadEmail): Promise<ReadEmailOutcome> {
  const mode = getReadEmailMode();
  if (mode === 'off') return { ok: false, mode, error: 'READ_EMAIL_MODE=off' };

  if (mode === 'preview') {
    try {
      const previewPath = await writePreview(msg);
      console.log(`[read-email] preview ${msg.kind} written: ${previewPath}`);
      return { ok: true, mode, previewPath };
    } catch (err: any) {
      console.error(`[read-email] preview ${msg.kind} failed:`, err?.message);
      return { ok: false, mode, error: err?.message ?? 'preview failed' };
    }
  }

  const from = { email: BUSINESS.sender.email, name: BUSINESS.sender.name };
  if (!from.email || from.email === PLACEHOLDER_SENDER) {
    console.error(`[read-email] ${msg.kind} not sent: SENDER_EMAIL is not configured`);
    return { ok: false, mode, error: 'SENDER_EMAIL not configured' };
  }
  if (!from.name || from.name === 'Your Business') from.name = 'Austin at Quantum Strategies';

  const transport = pickTransport();
  if (!transport) {
    console.error(`[read-email] ${msg.kind} not sent: no email transport configured (Gmail credentials or RESEND_API_KEY)`);
    return { ok: false, mode, error: 'no transport configured' };
  }

  try {
    const id = transport === 'gmail' ? await sendViaGmail(msg, from) : await sendViaResend(msg, from);
    console.log(`[read-email] ${msg.kind} sent via ${transport}`);
    return { ok: true, mode, transport, id };
  } catch (err: any) {
    console.error(`[read-email] ${msg.kind} send via ${transport} failed:`, err?.message);
    return { ok: false, mode, transport, error: err?.message ?? 'send failed' };
  }
}
