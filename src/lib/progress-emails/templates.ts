/**
 * Progress email copy and the founder digest. Pure: snapshot in, { subject, html, text } out.
 *
 * Each kind supplies its words (EmailCopy); compose() owns layout, the progress block,
 * the button, the signature and the footer, so every email has the same structure.
 * Copy rules: Austin's voice, short, no em dashes, no promised outcomes.
 */
import { escapeHtml, paragraphsHtml, renderShell, signature } from '@/lib/email/templates/read-shared';
import { RITE_NAMES, progressLines, type ProgressSnapshot } from './progress';
import { RULES, type Decision } from './schedule';
import { adminUserUrl, nextStepUrl, optOutPageUrl, settingsUrl } from './links';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateContext {
  appUrl: string;
  businessName: string;
  founderName: string;
  /** Physical mailing address for the footer. Omitted when not configured. */
  postalAddress?: string;
}

interface EmailCopy {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  showProgress: boolean;
  cta?: { label: string; url: string };
  /** Closing line before the signature. */
  closing?: string;
}

const REPLY_ASK = "If something's in the way, reply with one line and tell me what it is. I read every reply.";

function firstName(s: ProgressSnapshot): string {
  return s.user.name?.trim().split(/\s+/)[0] || 'there';
}

function copyFor(d: Decision, s: ProgressSnapshot, ctx: TemplateContext): EmailCopy {
  const name = firstName(s);
  const next = s.next;
  const cta = next ? { label: `Continue with ${next.productName}`, url: nextStepUrl(ctx.appUrl, next.slug, d.kind) } : undefined;
  const nextLine = next ? `Your next step is ${next.productName}, in ${RITE_NAMES[next.rite]}.` : '';

  switch (d.kind) {
    case 'reentry':
      return {
        subject: s.started ? `${name}, your next step in the Rites` : `${name}, your first step in the Rites`,
        preheader: nextLine,
        heading: s.started ? 'Where you left off' : 'Where to start',
        paragraphs: s.started
          ? [`Hi ${name},`, "It's been a while since you were in the Rites. Most people stall somewhere. The work is still here, right where you left it.", nextLine]
          : [`Hi ${name},`, "You have access to the Rites and haven't started yet. That's fine. The first step is short.", nextLine],
        showProgress: s.started,
        cta,
        closing: REPLY_ASK,
      };
    case 'nudge4':
      return {
        subject: `${next!.productName} is waiting`,
        preheader: `You were last in the Rites ${s.daysIdle} days ago.`,
        heading: 'Pick it back up while it is fresh',
        paragraphs: [`Hi ${name},`, `You were last in the Rites ${s.daysIdle} days ago. ${nextLine}`],
        showProgress: false,
        cta,
      };
    case 'nudge10':
      return {
        subject: `Still with you, ${name}`,
        preheader: REPLY_ASK,
        heading: 'Checking in',
        paragraphs: [`Hi ${name},`, `It's been ${s.daysIdle} days since your last step.`, REPLY_ASK, `Or pick up where you left off. ${nextLine}`],
        showProgress: true,
        cta,
      };
    case 'weekly':
      return {
        subject: 'Your Rites this week',
        preheader: nextLine,
        heading: 'Where you are',
        paragraphs: [`Hi ${name},`, 'Here is where you are in the Rites.', `${nextLine} One step this week is enough.`],
        showProgress: true,
        cta,
      };
    case 'complete': {
      const done = RITE_NAMES[d.rite!];
      const after = next ? `Next is ${RITE_NAMES[next.rite]}. Your first step there is ${next.productName}.` : 'That was the last Rite you have access to.';
      return {
        subject: `You finished ${done}`,
        preheader: after,
        heading: `${done} is complete`,
        paragraphs: [
          `Hi ${name},`,
          `You finished every part of ${done}.`,
          'Post what you found in #rites-of-passage on Discord. Saying it out loud is part of the work.',
          after,
        ],
        showProgress: true,
        cta,
        closing: next ? undefined : 'Reply and tell me what changed for you.',
      };
    }
  }
}

function progressBlock(s: ProgressSnapshot): { html: string; text: string } {
  const lines = progressLines(s);
  return {
    html: `<div class="mirror"><p class="label">Your progress</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>`,
    text: `Your progress\n${lines.map((l) => `- ${l}`).join('\n')}`,
  };
}

function footer(s: ProgressSnapshot, ctx: TemplateContext): { html: string; text: string } {
  const optOut = optOutPageUrl(ctx.appUrl, { userId: s.user.id, topic: 'progress' });
  const settings = settingsUrl(ctx.appUrl);
  const address = ctx.postalAddress ? [ctx.postalAddress] : [];
  return {
    html: [
      `<p>You get these because you're working through the Rites at ${escapeHtml(ctx.businessName)}.</p>`,
      `<p><a href="${escapeHtml(optOut)}">Stop progress emails</a> &middot; <a href="${escapeHtml(settings)}">Email settings</a></p>`,
      ...address.map((a) => `<p>${escapeHtml(a)}</p>`),
    ].join('\n'),
    text: [
      `You get these because you're working through the Rites at ${ctx.businessName}.`,
      `Stop progress emails: ${optOut}`,
      `Email settings: ${settings}`,
      ...address,
    ].join('\n'),
  };
}

function compose(copy: EmailCopy, s: ProgressSnapshot, ctx: TemplateContext): RenderedEmail {
  const sig = signature(ctx.founderName, ctx.businessName);
  const progress = copy.showProgress ? progressBlock(s) : null;
  const foot = footer(s, ctx);

  const bodyHtml = [
    paragraphsHtml(copy.paragraphs.filter(Boolean).join('\n\n')),
    progress?.html ?? '',
    copy.cta ? `<div class="cta"><a class="button" href="${escapeHtml(copy.cta.url)}">${escapeHtml(copy.cta.label)}</a></div>` : '',
    copy.closing ? paragraphsHtml(copy.closing) : '',
    sig.html,
  ].join('\n');

  const text = [
    ...copy.paragraphs.filter(Boolean),
    progress?.text,
    copy.cta ? `${copy.cta.label}: ${copy.cta.url}` : undefined,
    copy.closing,
    sig.text,
    '---',
    foot.text,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    subject: copy.subject,
    html: renderShell({ subject: copy.subject, preheader: copy.preheader, eyebrow: 'The Three Rites', heading: copy.heading, bodyHtml, footerHtml: foot.html }),
    text,
  };
}

export function renderProgressEmail(d: Decision, s: ProgressSnapshot, ctx: TemplateContext): RenderedEmail {
  return compose(copyFor(d, s, ctx), s, ctx);
}

/* ─── Founder digest ─────────────────────────────────────────────────────── */

/** Closest to finishing first: those are the easiest calls to win. */
export function sortForCalls(people: ProgressSnapshot[]): ProgressSnapshot[] {
  const score = (s: ProgressSnapshot) => s.rites.reduce((n, r) => n + r.done, 0);
  return [...people].sort((a, b) => score(b) - score(a) || a.daysIdle - b.daysIdle);
}

function stageLabel(s: ProgressSnapshot): string {
  if (!s.started) return 'Not started';
  return s.next ? `In ${RITE_NAMES[s.next.rite]}` : 'Finished';
}

export function renderFounderDigest(people: ProgressSnapshot[], ctx: TemplateContext): RenderedEmail {
  const intro = `These people have gone ${RULES.alertIdleDays} or more days without a step. Closest to finishing first.`;
  const sorted = sortForCalls(people);
  const subject = `${sorted.length} ${sorted.length === 1 ? 'person' : 'people'} to call`;
  const e = escapeHtml;

  const rows = sorted.map((s) => {
    const contact = [s.user.phone, s.user.email, s.user.discordUsername ? `Discord: ${s.user.discordUsername}` : null].filter(Boolean) as string[];
    const progress = progressLines(s).join(' · ') || 'No Rite progress yet';
    const optedOut = s.prefs.progress ? '' : 'Opted out of progress emails. Ask before adding more contact.';
    return { s, contact, progress, optedOut };
  });

  const bodyHtml = [
    paragraphsHtml(intro),
    ...rows.map(
      (r) => `<div class="move">
<p class="offer-head">${e(r.s.user.name || r.s.user.email)} &middot; ${e(stageLabel(r.s))} &middot; ${r.s.daysIdle} days quiet</p>
<p>${e(r.progress)}</p>
${r.s.next ? `<p>Next step: ${e(r.s.next.productName)}</p>` : ''}
<p>${r.contact.map(e).join('<br>')}</p>
${r.optedOut ? `<p class="hint">${e(r.optedOut)}</p>` : ''}
<p><a class="link" href="${e(adminUserUrl(ctx.appUrl, r.s.user.id))}">Open in admin</a></p>
</div>`,
    ),
  ].join('\n');

  const text = [
    intro,
    ...rows.map((r) =>
      [
        `${r.s.user.name || r.s.user.email} | ${stageLabel(r.s)} | ${r.s.daysIdle} days quiet`,
        r.progress,
        r.s.next ? `Next step: ${r.s.next.productName}` : '',
        ...r.contact,
        r.optedOut,
        adminUserUrl(ctx.appUrl, r.s.user.id),
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n\n');

  return {
    subject,
    html: renderShell({ subject, preheader: 'Closest to finishing first.', eyebrow: 'Who to call', heading: subject, bodyHtml, footerHtml: '<p>Internal alert from the progress emails.</p>' }),
    text,
  };
}
