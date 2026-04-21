# Quantum Strategies

Strategic consulting and course platform built with Next.js 16.

## Project Overview

**Quantum Strategies** is a professional consulting website featuring:
- Strategic consulting services
- Educational course platform (VCAP - Visionary Creator's Activation Protocol)
- Pillar/cluster content marketing (Articles, White Papers)
- Case studies and portfolio

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Hosting:** Vercel (primary)
- **Styling:** Tailwind CSS 4
- **Content:** MDX (next-mdx-remote)
- **Video:** Vimeo embeds

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (marketing)/      # Public pages (Home, About, Values)
│   ├── (content)/        # Articles, Blog, White Papers
│   ├── (content)/courses # Course marketing + public course pages
│   ├── dashboard/        # Authenticated portal (products, courses, affiliate)
│   └── products/         # Product experience routes
├── components/
├── content/              # MDX content files
└── lib/                  # Utilities and configs
```

## Deployment

Deployed on Vercel. A cron is configured for `/api/cron/backfill-crm`.

**Environment Variables Required (core):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` - Default Stripe payment link
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_QUANTUM` - Quantum Initiation product payment link
- `NEXT_PUBLIC_GPT_IFRAME_URL_QUANTUM` - Quantum Initiation GPT iframe URL

## GPT Products

The site includes embedded GPT knowledge products. Each product has:
- Dedicated sales page at `/products/{slug}`
- Interaction page at `/products/{slug}/interact` (post-purchase)
- Product-specific Stripe payment link with redirect
- Embedded ChatGPT iframe for interaction

**Adding New GPT Products:**
1. Add product config to `/src/lib/constants/products.ts`
2. Create product directory under `/src/app/(content)/products/{slug}/`
3. Add interact page by copying from existing product
4. Configure Stripe payment link success URL
5. Add environment variables for payment link and GPT iframe URL

## Documentation

- [Course Architecture](docs/architecture/COURSE_ARCHITECTURE.md)
- [Migration Plan](docs/plans/MIGRATION_PLAN.md)
