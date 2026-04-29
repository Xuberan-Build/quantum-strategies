-- CRM: Contact Lists and Email Campaigns

CREATE TABLE IF NOT EXISTS public.contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT NOT NULL DEFAULT 'static' CHECK (list_type IN ('static', 'smart')),
  filter_criteria JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by TEXT,
  UNIQUE(list_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'on_purchase', 'on_completion', 'on_signup')),
  trigger_product_slug TEXT,
  from_name TEXT NOT NULL DEFAULT 'Austin at Quantum Strategies',
  from_email TEXT NOT NULL DEFAULT 'austin@quantumstrategies.online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, step_number)
);

CREATE TABLE IF NOT EXISTS public.campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'unsubscribed', 'failed')),
  current_step INTEGER NOT NULL DEFAULT 1,
  next_send_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  step_number INTEGER NOT NULL,
  resend_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_list_members_list_id ON public.list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_user_id ON public.list_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign_id ON public.campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_active_next_send ON public.campaign_enrollments(next_send_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaign_sends_enrollment_id ON public.campaign_sends(enrollment_id);

-- RLS
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_contact_lists" ON public.contact_lists FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_list_members" ON public.list_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_campaigns" ON public.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_campaign_steps" ON public.campaign_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_campaign_enrollments" ON public.campaign_enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_campaign_sends" ON public.campaign_sends FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_crm_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_lists_updated_at
  BEFORE UPDATE ON public.contact_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

CREATE TRIGGER trg_campaign_steps_updated_at
  BEFORE UPDATE ON public.campaign_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

CREATE TRIGGER trg_campaign_enrollments_updated_at
  BEFORE UPDATE ON public.campaign_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

-- Grants
GRANT ALL ON public.contact_lists TO service_role;
GRANT ALL ON public.list_members TO service_role;
GRANT ALL ON public.campaigns TO service_role;
GRANT ALL ON public.campaign_steps TO service_role;
GRANT ALL ON public.campaign_enrollments TO service_role;
GRANT ALL ON public.campaign_sends TO service_role;
