
-- ============================================================
-- AEGIS EARLY WARNING SYSTEM — SCHEMA
-- Adapted for Lovable Cloud (no partitions, no pg_cron, no CHECK constraints)
-- ============================================================

-- ENUMS
CREATE TYPE public.alert_severity AS ENUM ('P1', 'P2', 'P3', 'INFO');
CREATE TYPE public.alert_status AS ENUM ('FIRING', 'RESOLVED', 'SUPPRESSED', 'ACKNOWLEDGED');
CREATE TYPE public.protocol_category AS ENUM (
  'DEX', 'BRIDGE', 'ORACLE', 'VALIDATOR', 'RPC',
  'LENDING', 'LIQUID_STAKING', 'LAUNCHPAD', 'INFRASTRUCTURE'
);
CREATE TYPE public.signal_type AS ENUM (
  'TVL_DROP', 'ORACLE_DEVIATION', 'ORACLE_STALENESS',
  'VALIDATOR_SKIP_RATE', 'SLOT_LAG', 'LIQUIDITY_DRAIN',
  'BRIDGE_IMBALANCE', 'TX_FAILURE_SPIKE', 'STAKE_SHIFT',
  'PRICE_IMPACT_INCREASE', 'CANARY_PROBE_FAILURE',
  'CROSS_SIGNAL_CORRELATION', 'RPC_LATENCY_SPIKE'
);
CREATE TYPE public.notification_channel AS ENUM (
  'TELEGRAM', 'DISCORD', 'EMAIL', 'WEBHOOK',
  'PUSH', 'ONCHAIN', 'SMS'
);
CREATE TYPE public.canary_status AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING');

-- ============================================================
-- PROTOCOLS
-- ============================================================
CREATE TABLE public.protocols (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  category          public.protocol_category NOT NULL,
  program_address   TEXT,
  website           TEXT,
  logo_url          TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  monitoring_config JSONB DEFAULT '{}',
  defillama_slug    TEXT,
  helius_filters    JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_protocols_category ON public.protocols(category);
CREATE INDEX idx_protocols_active ON public.protocols(is_active) WHERE is_active = TRUE;

-- ============================================================
-- SIGNALS (regular table, not partitioned)
-- ============================================================
CREATE TABLE public.signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id   UUID REFERENCES public.protocols(id) ON DELETE CASCADE,
  signal_type   public.signal_type NOT NULL,
  value         NUMERIC NOT NULL,
  baseline      NUMERIC,
  zscore        NUMERIC,
  metadata      JSONB DEFAULT '{}',
  source        TEXT NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_signals_protocol_time ON public.signals(protocol_id, recorded_at DESC);
CREATE INDEX idx_signals_type_time ON public.signals(signal_type, recorded_at DESC);
CREATE INDEX idx_signals_zscore ON public.signals(zscore) WHERE zscore > 2;

-- ============================================================
-- DETECTION RULES
-- ============================================================
CREATE TABLE public.detection_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT UNIQUE NOT NULL,
  description      TEXT,
  signal_type      public.signal_type NOT NULL,
  protocol_id      UUID REFERENCES public.protocols(id),
  category         public.protocol_category,
  threshold_value  NUMERIC,
  threshold_pct    NUMERIC,
  window_seconds   INTEGER DEFAULT 300,
  min_occurrences  INTEGER DEFAULT 1,
  severity         public.alert_severity NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE,
  cooldown_seconds INTEGER DEFAULT 300,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rules_active ON public.detection_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_rules_signal_type ON public.detection_rules(signal_type);

-- ============================================================
-- CORRELATION PATTERNS
-- ============================================================
CREATE TABLE public.correlation_patterns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT UNIQUE NOT NULL,
  description           TEXT NOT NULL,
  signals_required      JSONB NOT NULL,
  min_signals_match     INTEGER DEFAULT 2,
  severity              public.alert_severity NOT NULL,
  time_window_seconds   INTEGER DEFAULT 600,
  is_active             BOOLEAN DEFAULT TRUE,
  fire_count            INTEGER DEFAULT 0,
  true_positive_count   INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS (regular table, not partitioned)
-- ============================================================
CREATE TABLE public.alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID REFERENCES public.detection_rules(id),
  pattern_id        UUID REFERENCES public.correlation_patterns(id),
  protocol_id       UUID REFERENCES public.protocols(id),
  severity          public.alert_severity NOT NULL,
  status            public.alert_status DEFAULT 'FIRING',
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  signal_snapshot   JSONB NOT NULL,
  affected_protocols UUID[] DEFAULT '{}',
  onchain_signature TEXT,
  subscriber_count  INTEGER DEFAULT 0,
  acknowledged_by   UUID,
  acknowledged_at   TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  fired_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alerts_protocol_time ON public.alerts(protocol_id, fired_at DESC);
CREATE INDEX idx_alerts_severity ON public.alerts(severity, status);
CREATE INDEX idx_alerts_firing ON public.alerts(status) WHERE status = 'FIRING';

-- ============================================================
-- CANARY NODES
-- ============================================================
CREATE TABLE public.canary_nodes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id           TEXT UNIQUE NOT NULL,
  wallet_address    TEXT UNIQUE NOT NULL,
  api_key_hash      TEXT NOT NULL,
  reputation_score  NUMERIC DEFAULT 50.0,
  total_reports     INTEGER DEFAULT 0,
  accurate_reports  INTEGER DEFAULT 0,
  false_reports     INTEGER DEFAULT 0,
  last_seen_at      TIMESTAMPTZ,
  status            public.canary_status DEFAULT 'PENDING',
  geographic_region TEXT,
  version           TEXT,
  metadata          JSONB DEFAULT '{}',
  registered_at     TIMESTAMPTZ DEFAULT NOW(),
  banned_reason     TEXT
);
CREATE INDEX idx_canary_status ON public.canary_nodes(status);
CREATE INDEX idx_canary_reputation ON public.canary_nodes(reputation_score DESC);
CREATE INDEX idx_canary_wallet ON public.canary_nodes(wallet_address);

-- Validation trigger for reputation_score bounds
CREATE OR REPLACE FUNCTION public.validate_canary_reputation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reputation_score < 0 THEN NEW.reputation_score := 0; END IF;
  IF NEW.reputation_score > 100 THEN NEW.reputation_score := 100; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_canary_reputation BEFORE INSERT OR UPDATE ON public.canary_nodes
  FOR EACH ROW EXECUTE FUNCTION public.validate_canary_reputation();

-- ============================================================
-- CANARY REPORTS (regular table)
-- ============================================================
CREATE TABLE public.canary_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canary_id     UUID REFERENCES public.canary_nodes(id) ON DELETE CASCADE,
  protocol_id   UUID REFERENCES public.protocols(id),
  probe_name    TEXT NOT NULL,
  success       BOOLEAN NOT NULL,
  latency_ms    INTEGER,
  error_code    TEXT,
  error_message TEXT,
  raw_result    JSONB DEFAULT '{}',
  signature     TEXT NOT NULL,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_canary_reports_protocol ON public.canary_reports(protocol_id, reported_at DESC);
CREATE INDEX idx_canary_reports_canary ON public.canary_reports(canary_id, reported_at DESC);
CREATE INDEX idx_canary_reports_failure ON public.canary_reports(reported_at DESC) WHERE success = FALSE;

-- Validation trigger for latency_ms >= 0
CREATE OR REPLACE FUNCTION public.validate_canary_latency()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.latency_ms IS NOT NULL AND NEW.latency_ms < 0 THEN
    RAISE EXCEPTION 'latency_ms must be >= 0';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_canary_latency BEFORE INSERT OR UPDATE ON public.canary_reports
  FOR EACH ROW EXECUTE FUNCTION public.validate_canary_latency();

-- ============================================================
-- CANARY CONSENSUS
-- ============================================================
CREATE TABLE public.canary_consensus (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id       UUID REFERENCES public.protocols(id),
  probe_name        TEXT NOT NULL,
  window_start      TIMESTAMPTZ NOT NULL,
  window_end        TIMESTAMPTZ NOT NULL,
  total_reports     INTEGER NOT NULL,
  failure_count     INTEGER NOT NULL,
  failure_rate      NUMERIC NOT NULL,
  avg_latency_ms    NUMERIC,
  consensus_reached BOOLEAN DEFAULT FALSE,
  alert_triggered   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_consensus_protocol ON public.canary_consensus(protocol_id, window_start DESC);
CREATE INDEX idx_consensus_alert ON public.canary_consensus(alert_triggered) WHERE alert_triggered = TRUE;

-- Validation trigger for failure_rate bounds
CREATE OR REPLACE FUNCTION public.validate_consensus_failure_rate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.failure_rate < 0 THEN NEW.failure_rate := 0; END IF;
  IF NEW.failure_rate > 1 THEN NEW.failure_rate := 1; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_consensus_failure_rate BEFORE INSERT OR UPDATE ON public.canary_consensus
  FOR EACH ROW EXECUTE FUNCTION public.validate_consensus_failure_rate();

-- ============================================================
-- SUBSCRIBERS (no auth.users FK — uses text wallet/X auth)
-- ============================================================
CREATE TABLE public.aegis_subscribers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address          TEXT,
  x_user_id               TEXT,
  email                   TEXT,
  nickname                TEXT,
  global_min_severity     public.alert_severity DEFAULT 'P2',
  digest_mode             BOOLEAN DEFAULT FALSE,
  is_active               BOOLEAN DEFAULT TRUE,
  wallet_last_scanned_at  TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_aegis_subscribers_wallet ON public.aegis_subscribers(wallet_address);
CREATE INDEX idx_aegis_subscribers_active ON public.aegis_subscribers(is_active) WHERE is_active = TRUE;

-- ============================================================
-- SUBSCRIPTION CHANNELS
-- ============================================================
CREATE TABLE public.aegis_subscription_channels (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id  UUID REFERENCES public.aegis_subscribers(id) ON DELETE CASCADE,
  channel        public.notification_channel NOT NULL,
  destination    TEXT NOT NULL,
  is_verified    BOOLEAN DEFAULT FALSE,
  is_active      BOOLEAN DEFAULT TRUE,
  min_severity   public.alert_severity DEFAULT 'P2',
  config         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_channel_dest UNIQUE (subscriber_id, channel, destination)
);
CREATE INDEX idx_aegis_channels_subscriber ON public.aegis_subscription_channels(subscriber_id);
CREATE INDEX idx_aegis_channels_active ON public.aegis_subscription_channels(is_active) WHERE is_active = TRUE;

-- ============================================================
-- PROTOCOL SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.aegis_protocol_subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id    UUID REFERENCES public.aegis_subscribers(id) ON DELETE CASCADE,
  protocol_id      UUID REFERENCES public.protocols(id) ON DELETE CASCADE,
  min_severity     public.alert_severity DEFAULT 'P2',
  auto_detected    BOOLEAN DEFAULT FALSE,
  wallet_exposure  JSONB DEFAULT '{}',
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_sub_protocol UNIQUE (subscriber_id, protocol_id)
);
CREATE INDEX idx_aegis_proto_subs_subscriber ON public.aegis_protocol_subscriptions(subscriber_id);
CREATE INDEX idx_aegis_proto_subs_protocol ON public.aegis_protocol_subscriptions(protocol_id);

-- ============================================================
-- NOTIFICATION LOG (regular table)
-- ============================================================
CREATE TABLE public.aegis_notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id      UUID NOT NULL,
  subscriber_id UUID REFERENCES public.aegis_subscribers(id),
  channel       public.notification_channel NOT NULL,
  destination   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER DEFAULT 1,
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aegis_notif_log_alert ON public.aegis_notification_log(alert_id, sent_at DESC);
CREATE INDEX idx_aegis_notif_log_subscriber ON public.aegis_notification_log(subscriber_id, sent_at DESC);

-- Validation trigger for notification status
CREATE OR REPLACE FUNCTION public.validate_notif_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('sent', 'failed', 'deduped', 'queued') THEN
    RAISE EXCEPTION 'Invalid notification status. Must be: sent, failed, deduped, or queued';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_notif_status BEFORE INSERT OR UPDATE ON public.aegis_notification_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_notif_status();

-- ============================================================
-- SIGNAL BASELINES
-- ============================================================
CREATE TABLE public.signal_baselines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id  UUID REFERENCES public.protocols(id) ON DELETE CASCADE,
  signal_type  public.signal_type NOT NULL,
  mean_1h      NUMERIC,
  stddev_1h    NUMERIC,
  mean_24h     NUMERIC,
  stddev_24h   NUMERIC,
  mean_7d      NUMERIC,
  stddev_7d    NUMERIC,
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_baseline UNIQUE (protocol_id, signal_type)
);

-- ============================================================
-- ALERT DEDUP
-- ============================================================
CREATE TABLE public.alert_dedup (
  dedup_key  TEXT PRIMARY KEY,
  alert_id   UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dedup_expires ON public.alert_dedup(expires_at);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE public.aegis_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID,
  actor_type   TEXT NOT NULL DEFAULT 'system',
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_aegis_audit_actor ON public.aegis_audit_log(actor_id, created_at DESC);
CREATE INDEX idx_aegis_audit_action ON public.aegis_audit_log(action, created_at DESC);

-- Validation trigger for audit actor_type
CREATE OR REPLACE FUNCTION public.validate_audit_actor_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.actor_type NOT IN ('user', 'canary', 'system', 'edge_function') THEN
    RAISE EXCEPTION 'Invalid actor_type. Must be: user, canary, system, or edge_function';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_audit_actor_type BEFORE INSERT OR UPDATE ON public.aegis_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_audit_actor_type();

-- ============================================================
-- SYSTEM HEALTH
-- ============================================================
CREATE TABLE public.aegis_system_health (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'healthy',
  last_run_at     TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  error_message   TEXT,
  metrics         JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_aegis_component UNIQUE (component)
);

-- Validation trigger for system health status
CREATE OR REPLACE FUNCTION public.validate_system_health_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('healthy', 'degraded', 'down') THEN
    RAISE EXCEPTION 'Invalid system health status. Must be: healthy, degraded, or down';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_system_health_status BEFORE INSERT OR UPDATE ON public.aegis_system_health
  FOR EACH ROW EXECUTE FUNCTION public.validate_system_health_status();

-- ============================================================
-- VIEWS
-- ============================================================
CREATE VIEW public.v_active_alerts AS
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

CREATE VIEW public.v_protocol_health AS
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correlation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canary_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canary_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canary_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aegis_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aegis_subscription_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aegis_protocol_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aegis_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_dedup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aegis_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aegis_system_health ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ policies
CREATE POLICY "protocols_public_read" ON public.protocols FOR SELECT USING (TRUE);
CREATE POLICY "signals_public_read" ON public.signals FOR SELECT USING (TRUE);
CREATE POLICY "alerts_public_read" ON public.alerts FOR SELECT USING (TRUE);
CREATE POLICY "canary_consensus_public_read" ON public.canary_consensus FOR SELECT USING (TRUE);
CREATE POLICY "baselines_public_read" ON public.signal_baselines FOR SELECT USING (TRUE);
CREATE POLICY "aegis_system_health_public_read" ON public.aegis_system_health FOR SELECT USING (TRUE);
CREATE POLICY "rules_public_read" ON public.detection_rules FOR SELECT USING (TRUE);
CREATE POLICY "patterns_public_read" ON public.correlation_patterns FOR SELECT USING (TRUE);
CREATE POLICY "canary_nodes_public_read" ON public.canary_nodes FOR SELECT USING (TRUE);

-- SERVICE_ROLE WRITE policies (edge functions use service_role key)
CREATE POLICY "protocols_service_write" ON public.protocols FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "signals_service_insert" ON public.signals FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "alerts_service_write" ON public.alerts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "canary_nodes_service_all" ON public.canary_nodes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "canary_reports_service" ON public.canary_reports FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "canary_consensus_service_write" ON public.canary_consensus FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "baselines_service_write" ON public.signal_baselines FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "aegis_audit_service_only" ON public.aegis_audit_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "aegis_system_health_service_write" ON public.aegis_system_health FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "rules_service_write" ON public.detection_rules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "patterns_service_write" ON public.correlation_patterns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "dedup_service_only" ON public.alert_dedup FOR ALL USING (auth.role() = 'service_role');

-- Subscriber-scoped policies (deny all client access — managed via edge functions)
CREATE POLICY "aegis_subscribers_deny" ON public.aegis_subscribers FOR SELECT USING (FALSE);
CREATE POLICY "aegis_subscribers_service" ON public.aegis_subscribers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "aegis_channels_deny" ON public.aegis_subscription_channels FOR SELECT USING (FALSE);
CREATE POLICY "aegis_channels_service" ON public.aegis_subscription_channels FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "aegis_proto_subs_deny" ON public.aegis_protocol_subscriptions FOR SELECT USING (FALSE);
CREATE POLICY "aegis_proto_subs_service" ON public.aegis_protocol_subscriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "aegis_notif_log_deny" ON public.aegis_notification_log FOR SELECT USING (FALSE);
CREATE POLICY "aegis_notif_log_service" ON public.aegis_notification_log FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.aegis_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

CREATE TRIGGER trg_protocols_updated_at BEFORE UPDATE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.aegis_update_updated_at();
CREATE TRIGGER trg_aegis_subscribers_updated_at BEFORE UPDATE ON public.aegis_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.aegis_update_updated_at();

CREATE OR REPLACE FUNCTION public.compute_zscore(
  p_protocol_id UUID, p_signal_type public.signal_type,
  p_value NUMERIC, p_window TEXT DEFAULT '24h'
) RETURNS NUMERIC AS $$
DECLARE v_mean NUMERIC; v_stddev NUMERIC;
BEGIN
  IF p_window = '1h' THEN
    SELECT mean_1h, stddev_1h INTO v_mean, v_stddev FROM public.signal_baselines WHERE protocol_id = p_protocol_id AND signal_type = p_signal_type;
  ELSIF p_window = '7d' THEN
    SELECT mean_7d, stddev_7d INTO v_mean, v_stddev FROM public.signal_baselines WHERE protocol_id = p_protocol_id AND signal_type = p_signal_type;
  ELSE
    SELECT mean_24h, stddev_24h INTO v_mean, v_stddev FROM public.signal_baselines WHERE protocol_id = p_protocol_id AND signal_type = p_signal_type;
  END IF;
  IF v_stddev IS NULL OR v_stddev = 0 THEN RETURN NULL; END IF;
  RETURN (p_value - v_mean) / v_stddev;
END;
$$ LANGUAGE plpgsql STABLE SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.is_alert_deduped(p_rule_id UUID, p_protocol_id UUID) RETURNS BOOLEAN AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.alert_dedup
  WHERE dedup_key = p_rule_id::TEXT || ':' || p_protocol_id::TEXT AND expires_at > NOW();
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql STABLE SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.clean_expired_dedup() RETURNS VOID AS $$
BEGIN DELETE FROM public.alert_dedup WHERE expires_at < NOW(); END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.get_alert_subscribers(p_protocol_id UUID, p_severity public.alert_severity)
RETURNS TABLE (subscriber_id UUID, channel public.notification_channel, destination TEXT, config JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT sc.subscriber_id, sc.channel, sc.destination, sc.config
  FROM public.aegis_subscription_channels sc
  JOIN public.aegis_subscribers s ON s.id = sc.subscriber_id
  JOIN public.aegis_protocol_subscriptions ps ON ps.subscriber_id = sc.subscriber_id
  WHERE ps.protocol_id = p_protocol_id
    AND ps.is_active = TRUE AND s.is_active = TRUE AND sc.is_active = TRUE
    AND CASE sc.min_severity
          WHEN 'P1' THEN p_severity = 'P1'
          WHEN 'P2' THEN p_severity IN ('P1','P2')
          WHEN 'P3' THEN p_severity IN ('P1','P2','P3')
          ELSE TRUE END
    AND CASE s.global_min_severity
          WHEN 'P1' THEN p_severity = 'P1'
          WHEN 'P2' THEN p_severity IN ('P1','P2')
          WHEN 'P3' THEN p_severity IN ('P1','P2','P3')
          ELSE TRUE END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aegis_system_health;
