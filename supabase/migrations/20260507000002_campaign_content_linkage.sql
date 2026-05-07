-- Link campaign_steps to content_angles so distribution output can be traced
-- to the Studio piece that generated it.

ALTER TABLE campaign_steps
  ADD COLUMN IF NOT EXISTS content_angle_id UUID REFERENCES content_angles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distribute_format TEXT
    CHECK (distribute_format IN (
      'blog', 'social_twitter', 'social_linkedin', 'social_ig',
      'email', 'email_sequence', 'gpt_product', 'lead_magnet'
    ));

CREATE INDEX IF NOT EXISTS idx_campaign_steps_content_angle
  ON campaign_steps(content_angle_id)
  WHERE content_angle_id IS NOT NULL;
