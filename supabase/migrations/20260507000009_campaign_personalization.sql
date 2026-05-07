ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS personalized_html TEXT,
  ADD COLUMN IF NOT EXISTS personalized_text TEXT,
  ADD COLUMN IF NOT EXISTS personalization_model TEXT;
