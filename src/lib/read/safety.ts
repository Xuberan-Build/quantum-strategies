// STUB: replaced on merge. Real screen: spec v3 §6 lists (scoring/content agent).
import type { ReadAnswer, ReadAnswers, SafetyResult, SafetyTier } from './types';

const RANK: Record<SafetyTier, number> = { none: 0, hardship: 1, clinical: 2, crisis: 3 };
const LISTS: { tier: SafetyTier; list: string; re: RegExp }[] = [
  { tier: 'crisis', list: 'crisis_stub', re: /\b(kill myself|suicid\w*|end my life|want to die)\b/i },
  { tier: 'clinical', list: 'clinical_stub', re: /\b(depress\w*|ptsd|adhd)\b/i },
  { tier: 'hardship', list: 'hardship_stub', re: /\b(laid off|evicted|broke)\b/i },
];

export function screenText(text: string): SafetyResult {
  let tier: SafetyTier = 'none';
  const matchedLists: string[] = [];
  for (const l of LISTS) {
    if (l.re.test(text)) {
      matchedLists.push(l.list);
      if (RANK[l.tier] > RANK[tier]) tier = l.tier;
    }
  }
  return { tier, matchedLists };
}

function texts(a: ReadAnswer): string[] {
  const out: string[] = [];
  if (a.text) out.push(a.text);
  for (const v of Object.values(a.parts ?? {})) {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) out.push(...v);
  }
  return out;
}

export function screenAnswers(answers: ReadAnswers): SafetyResult {
  let tier: SafetyTier = 'none';
  const lists = new Set<string>();
  for (const a of Object.values(answers)) {
    for (const t of texts(a)) {
      const r = screenText(t);
      r.matchedLists.forEach((l) => lists.add(l));
      if (RANK[r.tier] > RANK[tier]) tier = r.tier;
    }
  }
  return { tier, matchedLists: [...lists] };
}
