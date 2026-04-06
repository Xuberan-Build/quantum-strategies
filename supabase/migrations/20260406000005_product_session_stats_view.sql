-- Aggregated session stats per product — replaces full table scans in admin
CREATE OR REPLACE VIEW product_session_stats AS
SELECT
  product_slug,
  COUNT(*)                                    AS total_sessions,
  COUNT(*) FILTER (WHERE is_complete = true)  AS completed_sessions
FROM product_sessions
GROUP BY product_slug;
