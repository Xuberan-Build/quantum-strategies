CREATE TABLE IF NOT EXISTS public.session_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL REFERENCES public.product_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  product_slug TEXT NOT NULL,
  business_model TEXT,
  pain_points TEXT[],
  revenue_goal TEXT,
  themes TEXT[],
  hd_type TEXT,
  hd_authority TEXT,
  sun_sign TEXT,
  moon_sign TEXT,
  extraction_model TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_insights_product_slug ON public.session_insights(product_slug);
CREATE INDEX IF NOT EXISTS idx_session_insights_hd_type ON public.session_insights(hd_type);
CREATE INDEX IF NOT EXISTS idx_session_insights_extracted_at ON public.session_insights(extracted_at);

ALTER TABLE public.session_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_session_insights" ON public.session_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON public.session_insights TO service_role;
