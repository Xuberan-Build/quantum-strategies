/**
 * Shared pieces for the Perception Read emails (pure, no I/O).
 *
 * Voice: Austin, first person, plain sentences (brain/content/tonality.md).
 * No em-dashes, no exclamation marks, no "X, not Y" frames, no "quantum".
 */

import type { PatternId } from '@/lib/read/types';

export interface RenderedReadEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export type ReadEmailKind = 'r1' | 'day2' | 'day7';

export const BRAND_PRIMARY = '#030048';
export const BRAND_ACCENT = '#6C5CE7';

/** Pattern names and one-line reads (spec v3 §7.1). Fallback only: the result's own copy wins. */
export const READ_PATTERN_COPY: Record<PatternId, { name: string; read: string }> = {
  SHOULDS: {
    name: 'Running on shoulds',
    read: "Most of your week goes to what you think you should do, and the thing you want gets what's left.",
  },
  NOT_CAUGHT_UP: {
    name: 'It never feels like enough',
    read: "You keep adding to your record, and the picture you run on doesn't count it, so nothing feels like enough.",
  },
  ON_EMPTY: {
    name: 'Yes to everyone but you',
    read: "You say yes before you've checked the cost, and the cost lands on you.",
  },
  NO_THREAD: {
    name: 'Too many interests, no thread yet',
    read: "You have more interests than hours, and the thread that ties them together isn't named yet.",
  },
  SMALLER: {
    name: 'Selling yourself short',
    read: "You do the work, then shrink it when it's time to show it or charge for it.",
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Adds UTMs to an absolute URL. utm_campaign names the email, utm_content the link. */
export function withReadUtm(url: string, kind: ReadEmailKind, content: string): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'email');
  u.searchParams.set('utm_medium', kind === 'r1' ? 'transactional' : 'lifecycle');
  u.searchParams.set('utm_campaign', `perception-read-${kind}`);
  u.searchParams.set('utm_content', content);
  return u.toString();
}

/**
 * Block bodies come as plain text or light markdown. Email gets plain text:
 * strip emphasis markers and links, collapse whitespace, swap em-dashes for commas.
 */
export function toPlain(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:]|$)/g, '$1$2')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain text → HTML paragraphs (escaped). */
export function paragraphsHtml(value: string, style = ''): string {
  return value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p${style ? ` style="${style}"` : ''}>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export interface ShellInput {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  footerHtml: string;
}

export function renderShell(input: ShellInput): string {
  const e = escapeHtml;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(input.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${BRAND_PRIMARY} 0%, #1a0066 100%); color: #F8F5FF; padding: 28px 30px; }
    .header p { margin: 0 0 6px 0; font-size: 13px; opacity: 0.85; letter-spacing: 0.04em; text-transform: uppercase; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.3; }
    .content { padding: 32px 30px; font-size: 16px; }
    .content p { margin: 0 0 16px 0; }
    .mirror { background: #f8f7ff; border-left: 4px solid ${BRAND_ACCENT}; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0; }
    .mirror p { margin: 0 0 6px 0; }
    .label { margin: 0 0 4px 0 !important; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; }
    .move { border: 1px solid #e6e3f5; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
    .cta { text-align: center; margin: 28px 0 8px 0; }
    .button { display: inline-block; background: ${BRAND_ACCENT}; color: #ffffff !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 17px; }
    .offer { border: 1px solid #e6e3f5; border-radius: 8px; padding: 18px 20px; margin: 28px 0 0 0; font-size: 15px; }
    .offer-head { margin: 0 0 8px 0 !important; font-weight: 600; color: ${BRAND_PRIMARY}; }
    .link { color: ${BRAND_ACCENT}; font-weight: 600; text-decoration: none; }
    .q { margin: 28px 0 0 0; }
    .q-title { font-weight: 600; color: ${BRAND_PRIMARY}; margin: 0 0 10px 0 !important; }
    .chip { display: inline-block; border: 1px solid ${BRAND_ACCENT}; color: ${BRAND_ACCENT} !important; text-decoration: none; border-radius: 6px; padding: 8px 12px; margin: 0 6px 8px 0; font-size: 15px; }
    .scale .chip { min-width: 18px; text-align: center; padding: 8px 10px; }
    .hint { font-size: 13px; color: #777; margin: 4px 0 0 0 !important; }
    .footer { background: #f8f9fa; padding: 22px 30px; text-align: center; color: #777; font-size: 12px; }
    .footer p { margin: 0 0 8px 0; }
    .footer a { color: #777; }
    @media only screen and (max-width: 620px) {
      .container { margin: 0; border-radius: 0; }
      .content { padding: 26px 20px; }
      .header { padding: 24px 20px; }
      .button { display: block; padding: 15px 20px; }
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${e(input.preheader)}</div>
  <div class="container">
    <div class="header">
      <p>${e(input.eyebrow)}</p>
      <h1>${e(input.heading)}</h1>
    </div>
    <div class="content">
${input.bodyHtml}
    </div>
    <div class="footer">
${input.footerHtml}
    </div>
  </div>
</body>
</html>`;
}

export function signature(founderName: string, businessName: string): { html: string; text: string } {
  return {
    html: `<p>${escapeHtml(founderName)}<br><span style="color:#666;font-size:14px;">Founder, ${escapeHtml(businessName)}</span></p>`,
    text: `${founderName}\nFounder, ${businessName}`,
  };
}
