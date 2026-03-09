
-- Fix security definer views by explicitly setting security_invoker = true
DROP VIEW IF EXISTS public.v_active_alerts;
DROP VIEW IF EXISTS public.v_protocol_health;

CREATE VIEW public.v_active_alerts WITH (security_invoker = true) AS
SELECT
  a.id, a.severity, a.status, a.title, a.description,
  a.signal_snapshot, a.subscriber_count, a.fired_at,
  p.name AS protocol_name, p.slug AS protocol_slug,
  p.category AS protocol_category, p.logo_url
FROM public.alerts a
JOIN public.protocols p ON p.id = a.protocol_id
WHERE a.status = 'FIRING'
ORDER BY
  CASE a.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
  a.fired_at DESC;

CREATE VIEW public.v_protocol_health WITH (security_invoker = true) AS
SELECT
  p.id, p.slug, p.name, p.category, p.logo_url, p.program_address,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'FIRING' AND a.severity = 'P1') AS active_p1,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'FIRING' AND a.severity = 'P2') AS active_p2,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'FIRING' AND a.severity = 'P3') AS active_p3,
  MAX(a.fired_at) AS last_alert_at,
  (SELECT COUNT(*) FROM public.canary_consensus cc
   WHERE cc.protocol_id = p.id AND cc.alert_triggered = TRUE
   AND cc.window_start > NOW() - INTERVAL '1 hour') AS canary_failures_1h
FROM public.protocols p
LEFT JOIN public.alerts a ON a.protocol_id = p.id AND a.fired_at > NOW() - INTERVAL '24 hours'
WHERE p.is_active = TRUE
GROUP BY p.id, p.slug, p.name, p.category, p.logo_url, p.program_address;
