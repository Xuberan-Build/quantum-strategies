-- Expose PLG/pillar/Stripe fields on product_definitions (columns may already
-- exist from a prior migration — IF NOT EXISTS guards are safe to re-run).

ALTER TABLE product_definitions
  ADD COLUMN IF NOT EXISTS plg_stage TEXT
    CHECK (plg_stage IN ('awareness', 'interest', 'consideration', 'conversion', 'expansion')),
  ADD COLUMN IF NOT EXISTS pillar_id UUID
    REFERENCES content_pillars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_product_definitions_plg_stage
  ON product_definitions(plg_stage)
  WHERE plg_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_definitions_pillar
  ON product_definitions(pillar_id)
  WHERE pillar_id IS NOT NULL;

-- Ensure the shared updated_at trigger function exists.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Structured landing page content per product, edited in the admin and
-- served to the public-facing product page.
CREATE TABLE IF NOT EXISTS product_landing_pages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID        NOT NULL UNIQUE REFERENCES product_definitions(id) ON DELETE CASCADE,
  slug             TEXT        NOT NULL UNIQUE,
  status           TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  hero_headline    TEXT,
  hero_accent      TEXT,
  hero_description TEXT,
  hero_microcopy   TEXT,
  hero_cta_label   TEXT        DEFAULT 'Get Started',
  features         JSONB       DEFAULT '[]',
  pricing_headline TEXT,
  pricing_bullets  JSONB       DEFAULT '[]',
  faq              JSONB       DEFAULT '[]',
  seo_title        TEXT,
  seo_description  TEXT,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_slug
  ON product_landing_pages(slug);

CREATE INDEX IF NOT EXISTS idx_landing_pages_product_id
  ON product_landing_pages(product_id);

CREATE INDEX IF NOT EXISTS idx_landing_pages_published
  ON product_landing_pages(status)
  WHERE status = 'published';

CREATE TRIGGER trg_landing_pages_updated_at
  BEFORE UPDATE ON product_landing_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_landing_pages ENABLE ROW LEVEL SECURITY;

-- Admins can do anything.
CREATE POLICY "admin_all_landing_pages"
  ON product_landing_pages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  );

-- Public (anon) can read published pages only.
CREATE POLICY "public_select_published_landing_pages"
  ON product_landing_pages FOR SELECT
  TO anon
  USING (status = 'published');
