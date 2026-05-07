-- Product landing pages: DB-driven content for public product pages
CREATE TABLE IF NOT EXISTS product_landing_pages (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug    TEXT    NOT NULL UNIQUE,
  status          TEXT    NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published')),
  badge           TEXT,
  hero_headline   TEXT,
  hero_accent     TEXT,
  hero_description TEXT,
  hero_microcopy  TEXT,
  hero_cta_label  TEXT    NOT NULL DEFAULT 'Get Started',
  features        JSONB   NOT NULL DEFAULT '[]',
  pricing_headline TEXT,
  pricing_bullets JSONB   NOT NULL DEFAULT '[]',
  pricing_cta     TEXT,
  faq             JSONB   NOT NULL DEFAULT '[]',
  seo_title       TEXT,
  seo_description TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_slug_status
  ON product_landing_pages (product_slug, status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_landing_page_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_landing_page_updated_at
  BEFORE UPDATE ON product_landing_pages
  FOR EACH ROW EXECUTE FUNCTION update_landing_page_updated_at();

-- RLS: admins can do everything, public can read published rows
ALTER TABLE product_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to landing pages"
  ON product_landing_pages FOR ALL
  USING (true)
  WITH CHECK (true);
