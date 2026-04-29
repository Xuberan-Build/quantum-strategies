-- Seed system smart lists
-- These are built-in lists that resolve dynamically at enroll time
-- filter_criteria drives how they resolve (not list_members rows)

INSERT INTO public.contact_lists (name, description, list_type, filter_criteria, created_by)
VALUES
  (
    'All Users',
    'Every registered QS user',
    'smart',
    '{"source": "all_users"}'::jsonb,
    'system'
  ),
  (
    'Discord Community',
    'QS users who have linked a Discord account',
    'smart',
    '{"source": "discord_linked"}'::jsonb,
    'system'
  )
ON CONFLICT DO NOTHING;
