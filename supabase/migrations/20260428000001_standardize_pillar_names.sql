-- Align content_pillars titles with customer navigation labels
UPDATE public.content_pillars SET title = 'Identity & Brand'      WHERE title ILIKE '%self%' OR title ILIKE '%signal%';
UPDATE public.content_pillars SET title = 'Mindset & Worldview'   WHERE title ILIKE '%architecture%' OR title ILIKE '%reality%';
UPDATE public.content_pillars SET title = 'Business Strategy'     WHERE title ILIKE '%strategy%';
UPDATE public.content_pillars SET title = 'Network & Community'   WHERE title ILIKE '%network%';
UPDATE public.content_pillars SET title = 'Growth & Marketing'    WHERE title ILIKE '%builder%';
