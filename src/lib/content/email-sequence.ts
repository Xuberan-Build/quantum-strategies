/**
 * Parsing for distribute's email outputs (piece types `email` and `email_sequence`).
 *
 * The sequence prompt asks for full emails in a marked structure:
 *
 *   === EMAIL 1 ===
 *   PURPOSE: welcome
 *   SUBJECT: ...
 *   PREVIEW: ...
 *   BODY:
 *   <the complete email>
 *
 * Older pieces used "EMAIL 1 — welcome" headers and 150–200 word *summaries* as the
 * body. Those still parse, but bodies under MIN_EMAIL_BODY_WORDS are flagged as
 * summaries so they are never loaded into a campaign as the email that gets sent.
 *
 * Pure functions: safe on the client and in tests.
 */

export const MIN_EMAIL_BODY_WORDS = 120;

export interface ParsedEmail {
  index: number;
  purpose: string;
  subject: string;
  preview: string;
  body: string;
  wordCount: number;
  /** True when the body is too short to be a real email (e.g. a legacy summary). */
  isSummary: boolean;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const FIELD = (name: string) => new RegExp(`^\\s*\\**${name}\\**\\s*:\\s*(.*)$`, 'im');

function field(block: string, name: string): string {
  const m = FIELD(name).exec(block);
  return m ? m[1].trim().replace(/^\[|\]$/g, '').trim() : '';
}

/** Body = everything after a `BODY:` line, or else the block minus its header fields. */
function extractBody(block: string): string {
  const bodyMarker = /^\s*\**BODY\**\s*:\s*/im.exec(block);
  let body: string;
  if (bodyMarker) {
    body = block.slice(bodyMarker.index + bodyMarker[0].length);
  } else {
    body = block
      .split('\n')
      .filter((line) => !/^\s*\**(PURPOSE|SUBJECT|PREVIEW)\**\s*:/i.test(line))
      .join('\n');
  }
  return body.trim().replace(/^\[([\s\S]*)\]$/, '$1').trim();
}

function toEmail(block: string, index: number, headerPurpose = ''): ParsedEmail {
  const body = extractBody(block);
  const wordCount = countWords(body);
  return {
    index,
    purpose: field(block, 'PURPOSE') || headerPurpose,
    subject: field(block, 'SUBJECT'),
    preview: field(block, 'PREVIEW'),
    body,
    wordCount,
    isSummary: wordCount < MIN_EMAIL_BODY_WORDS,
  };
}

/** Splits a sequence into emails. Returns [] when no email headers are found. */
export function parseEmailSequence(text: string): ParsedEmail[] {
  const normalised = text.replace(/\r\n/g, '\n');

  // Current format: "=== EMAIL N ===" markers.
  const marker = /^\s*={2,}\s*EMAIL\s+(\d+)\s*={2,}\s*$/gim;
  const markers = [...normalised.matchAll(marker)];
  if (markers.length > 0) {
    return markers.map((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < markers.length ? markers[i + 1].index ?? normalised.length : normalised.length;
      return toEmail(normalised.slice(start, end), Number(m[1]) || i + 1);
    });
  }

  // Legacy format: "EMAIL N — purpose" / "Email N: purpose" header lines.
  const legacy = /^\s*\**EMAIL\s+(\d+)\**\s*(?:[—–:-]\s*(.*))?$/gim;
  const headers = [...normalised.matchAll(legacy)];
  return headers.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < headers.length ? headers[i + 1].index ?? normalised.length : normalised.length;
    const headerPurpose = (m[2] ?? '').replace(/^\[?Purpose:\s*/i, '').replace(/\]$/, '').trim();
    return toEmail(normalised.slice(start, end), Number(m[1]) || i + 1, headerPurpose);
  });
}

/** A single `email` piece: SUBJECT/PREVIEW lines up top, the rest is the body. */
export function parseSingleEmail(text: string): Omit<ParsedEmail, 'index' | 'purpose'> {
  const email = toEmail(text.replace(/\r\n/g, '\n'), 1);
  return { subject: email.subject, preview: email.preview, body: email.body, wordCount: email.wordCount, isSummary: email.isSummary };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain-text email → minimal safe HTML (escaped; blank lines become paragraphs). */
export function textToEmailHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}
