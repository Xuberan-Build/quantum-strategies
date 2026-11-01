/**
 * Self-hosted fonts (next/font/local). Replaces next/font/google, whose build-time fetch from
 * fonts.gstatic.com kept failing Vercel builds ("Can't resolve
 * '@vercel/turbopack-next/internal/font/google/font'", 2026-10-26 and 2026-11-01).
 *
 * Files: latin-subset variable woff2 from @fontsource-variable (OFL-1.1), in ./fonts/.
 * Variable names are unchanged, so no CSS had to change.
 */
import localFont from 'next/font/local';

// Site-wide (root layout)
export const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-inter',
  display: 'swap',
});

export const bodoniModa = localFont({
  src: [
    { path: './fonts/bodoni-moda-latin-wght-normal.woff2', weight: '400 900', style: 'normal' },
    { path: './fonts/bodoni-moda-latin-wght-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  variable: '--font-bodoni',
  display: 'swap',
});

// Cormorant Garamond + JetBrains Mono: /admin/brain and /inner-outer-alignment/.
// Each surface keeps its own CSS variable name.
// next/font requires literal options, so the sources are repeated rather than shared.
export const brainSerif = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-wght-normal.woff2', weight: '300 700', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-wght-italic.woff2', weight: '300 700', style: 'italic' },
  ],
  variable: '--font-brain-serif',
  display: 'swap',
});
export const brainMono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-brain-mono',
  display: 'swap',
});

export const ioaSerif = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-wght-normal.woff2', weight: '300 700', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-wght-italic.woff2', weight: '300 700', style: 'italic' },
  ],
  variable: '--font-ioa-serif',
  display: 'swap',
});
export const ioaMono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-ioa-mono',
  display: 'swap',
});
