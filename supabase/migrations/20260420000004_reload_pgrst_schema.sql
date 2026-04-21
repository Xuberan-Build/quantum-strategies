-- Force PostgREST to reload its schema cache so content_posts becomes visible
-- content_posts table was created in 20260406000006 but PGRST205 errors suggest
-- the cache hasn't picked it up yet.
NOTIFY pgrst, 'reload schema';
