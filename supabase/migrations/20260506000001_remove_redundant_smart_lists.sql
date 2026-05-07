-- Remove "All Users" and "Discord Community" smart lists — these are
-- redundant with the dedicated Users and Discord admin pages.
DELETE FROM public.contact_lists
WHERE list_type = 'smart'
  AND filter_criteria->>'source' IN ('all_users', 'discord_linked')
  AND created_by = 'system';
