export const TABS = [
  { key: 'brief',      label: 'Brief'      },
  { key: 'research',   label: 'Research'   },
  { key: 'outline',    label: 'Outline'    },
  { key: 'draft',      label: 'Draft'      },
  { key: 'distribute', label: 'Distribute' },
] as const;

export type Tab = typeof TABS[number]['key'];

export const FORMAT_META: Record<string, { label: string; color: string }> = {
  ebook:      { label: 'Ebook',      color: '#8b5cf6' },
  webinar:    { label: 'Webinar',    color: '#3b82f6' },
  ecourse:    { label: 'E-Course',   color: '#10b981' },
  whitepaper: { label: 'Whitepaper', color: '#f59e0b' },
};

export const PIECE_LABELS: Record<string, string> = {
  blog:            'Blog Post',
  social_twitter:  'Twitter Thread',
  social_linkedin: 'LinkedIn Post',
  social_ig:       'Instagram Caption',
  email:           'Launch Email',
  email_sequence:  'Email Sequence',
  gpt_product:     'GPT Product Prompt',
};

export const TRADITION_META: Record<string, { label: string; color: string }> = {
  taoism:             { label: 'Taoism',             color: '#10b981' },
  kabbalah:           { label: 'Kabbalah',           color: '#8b5cf6' },
  tantra:             { label: 'Tantra',             color: '#ef4444' },
  sufism:             { label: 'Sufism',             color: '#f59e0b' },
  christian_mysticism:{ label: 'Christian Mysticism',color: '#3b82f6' },
  hermeticism:        { label: 'Hermeticism',        color: '#a855f7' },
  rosicrucianism:     { label: 'Rosicrucianism',     color: '#d97706' },
  science:            { label: 'Science',            color: '#06b6d4' },
  buddhism:           { label: 'Buddhism',           color: '#f97316' },
  hinduism:           { label: 'Hinduism',           color: '#fb923c' },
  qs_doctrine:        { label: 'QS Doctrine',        color: '#e11d48' },
};
