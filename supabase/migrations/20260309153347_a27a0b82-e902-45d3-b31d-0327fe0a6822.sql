
-- Enable pg_net extension for HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create baseline refresh function
CREATE OR REPLACE FUNCTION public.refresh_signal_baselines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Upsert 1h baselines
  INSERT INTO public.signal_baselines (protocol_id, signal_type, mean_1h, stddev_1h, sample_count, last_updated)
  SELECT
    s.protocol_id,
    s.signal_type,
    AVG(s.value),
    COALESCE(STDDEV_SAMP(s.value), 0),
    COUNT(*)::integer,
    NOW()
  FROM public.signals s
  WHERE s.recorded_at > NOW() - INTERVAL '1 hour'
  GROUP BY s.protocol_id, s.signal_type
  ON CONFLICT (protocol_id, signal_type)
  DO UPDATE SET
    mean_1h = EXCLUDED.mean_1h,
    stddev_1h = EXCLUDED.stddev_1h,
    sample_count = EXCLUDED.sample_count,
    last_updated = NOW();

  -- Update 24h baselines
  UPDATE public.signal_baselines sb SET
    mean_24h = sub.mean_val,
    stddev_24h = sub.stddev_val
  FROM (
    SELECT protocol_id, signal_type, AVG(value) as mean_val, COALESCE(STDDEV_SAMP(value), 0) as stddev_val
    FROM public.signals
    WHERE recorded_at > NOW() - INTERVAL '24 hours'
    GROUP BY protocol_id, signal_type
  ) sub
  WHERE sb.protocol_id = sub.protocol_id AND sb.signal_type = sub.signal_type;

  -- Update 7d baselines
  UPDATE public.signal_baselines sb SET
    mean_7d = sub.mean_val,
    stddev_7d = sub.stddev_val
  FROM (
    SELECT protocol_id, signal_type, AVG(value) as mean_val, COALESCE(STDDEV_SAMP(value), 0) as stddev_val
    FROM public.signals
    WHERE recorded_at > NOW() - INTERVAL '7 days'
    GROUP BY protocol_id, signal_type
  ) sub
  WHERE sb.protocol_id = sub.protocol_id AND sb.signal_type = sub.signal_type;
END;
$$;

-- Create auto-resolve stale alerts function
CREATE OR REPLACE FUNCTION public.auto_resolve_stale_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.alerts
  SET status = 'RESOLVED', resolved_at = NOW()
  WHERE status = 'FIRING'
    AND severity IN ('P3', 'INFO')
    AND fired_at < NOW() - INTERVAL '6 hours';

  UPDATE public.alerts
  SET status = 'RESOLVED', resolved_at = NOW()
  WHERE status = 'FIRING'
    AND severity = 'P2'
    AND fired_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Add unique constraint on signal_baselines for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signal_baselines_protocol_signal_unique'
  ) THEN
    ALTER TABLE public.signal_baselines
      ADD CONSTRAINT signal_baselines_protocol_signal_unique UNIQUE (protocol_id, signal_type);
  END IF;
END;
$$;

-- Prune old signals function (keep 7 days only)
CREATE OR REPLACE FUNCTION public.prune_old_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.signals WHERE recorded_at < NOW() - INTERVAL '7 days';
END;
$$;
