-- Extend content_angles to track which distribution formats have been generated
-- and whether the angle functions as a lead magnet entry point.

ALTER TABLE content_angles
  ADD COLUMN IF NOT EXISTS lead_magnet_type TEXT
    CHECK (lead_magnet_type IN ('guide', 'quiz', 'webinar', 'email_course', 'template')),
  ADD COLUMN IF NOT EXISTS distribute_formats TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_content_angles_lead_magnet
  ON content_angles(lead_magnet_type)
  WHERE lead_magnet_type IS NOT NULL;
