-- Seed data-driven smart list segments
-- Each resolves dynamically at query time via filter_criteria.source

INSERT INTO public.contact_lists (name, description, list_type, filter_criteria, created_by)
VALUES
  (
    'Affiliates',
    'QS users enrolled in the affiliate program',
    'smart',
    '{"source": "affiliates"}'::jsonb,
    'system'
  ),
  (
    'Has Chart Data',
    'Users who have confirmed their astrology/HD placements',
    'smart',
    '{"source": "placements_confirmed"}'::jsonb,
    'system'
  ),
  (
    'Paying Customers',
    'Users with a Stripe customer record (made at least one purchase)',
    'smart',
    '{"source": "stripe_customers"}'::jsonb,
    'system'
  ),
  (
    'Completed a Product',
    'Users who have finished at least one product experience',
    'smart',
    '{"source": "completed_product"}'::jsonb,
    'system'
  ),
  (
    'Beta Participants',
    'Users enrolled in the Three Rites beta program',
    'smart',
    '{"source": "beta_participants"}'::jsonb,
    'system'
  )
ON CONFLICT DO NOTHING;
