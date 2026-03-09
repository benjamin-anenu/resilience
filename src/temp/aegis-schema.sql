-- ============================================================
-- AEGIS SUPPLY CHAIN DETECTION — SUPABASE SCHEMA
-- Version: 1.0.0
-- Security: RLS enabled on all tables
-- Scalability: Partitioned time-series, indexed for speed
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE alert_severity AS ENUM ('P1', 'P2', 'P3', 'INFO');
CREATE TYPE alert_status    AS ENUM ('FIRING', 'RESOLVED', 'SUPPRESSED', 'ACKNOWLEDGED');
CREATE TYPE protocol_category AS ENUM (
  'DEX', 'BRIDGE', 'ORACLE', 'VALIDATOR', 'RPC',
  'LENDING', 'LIQUID_STAKING', 'LAUNCHPAD', 'INFRASTRUCTURE'
);
CREATE TYPE signal_type AS ENUM (
  'TVL_DROP', 'ORACLE_DEVIATION', 'ORACLE_STALENESS',
  'VALIDATOR_SKIP_RATE', 'SLOT_LAG', 'LIQUIDITY_DRAIN',
  'BRIDGE_IMBALANCE', 'TX_FAILURE_SPIKE', 'STAKE_SHIFT',
  'PRICE_IMPACT_INCREASE', 'CANARY_PROBE_FAILURE',
  'CROSS_SIGNAL_CORRELATION', 'RPC_LATENCY_SPIKE'
);
CREATE TYPE notification_channel AS ENUM (
  'TELEGRAM', 'DISCORD', 'EMAIL', 'WEBHOOK',
  'PUSH', 'ONCHAIN', 'SMS'
);
CREATE TYPE canary_status AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING');

-- ============================================================
-- PROTOCOLS
-- ============================================================
CREATE TABLE protocols (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  category          protocol_category NOT NULL,
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

CREATE INDEX idx_protocols_category ON protocols(category);
CREATE INDEX idx_protocols_active   ON protocols(is_active) WHERE is_active = TRUE;

-- ============================================================
-- SIGNALS (partitioned by quarter)
-- ============================================================
CREATE TABLE signals (
  id            UUID DEFAULT uuid_generate_v4(),
  protocol_id   UUID REFERENCES protocols(id) ON DELETE CASCADE,
  signal_type   signal_type NOT NULL,
  value         NUMERIC NOT NULL,
  baseline      NUMERIC,
  zscore        NUMERIC,
  metadata      JSONB DEFAULT '{}',
  source        TEXT NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE signals_2025_q1 PARTITION OF signals FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE signals_2025_q2 PARTITION OF signals FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE signals_2025_q3 PARTITION OF signals FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE signals_2025_q4 PARTITION OF signals FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');
CREATE TABLE signals_2026_q1 PARTITION OF signals FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE signals_2026_q2 PARTITION OF signals FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE signals_2026_q3 PARTITION OF signals FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE signals_2026_q4 PARTITION OF signals FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE INDEX idx_signals_protocol_time ON signals(protocol_id, recorded_at DESC);
CREATE INDEX idx_signals_type_time     ON signals(signal_type, recorded_at DESC);
CREATE INDEX idx_signals_zscore        ON signals(zscore) WHERE zscore > 2;

-- ============================================================
-- DETECTION RULES
-- ============================================================
CREATE TABLE detection_rules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT UNIQUE NOT NULL,
  description      TEXT,
  signal_type      signal_type NOT NULL,
  protocol_id      UUID REFERENCES protocols(id),
  category         protocol_category,
  threshold_value  NUMERIC,
  threshold_pct    NUMERIC,
  window_seconds   INTEGER DEFAULT 300,
  min_occurrences  INTEGER DEFAULT 1,
  severity         alert_severity NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE,
  cooldown_seconds INTEGER DEFAULT 300,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rules_active      ON detection_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_rules_signal_type ON detection_rules(signal_type);

-- ============================================================
-- CORRELATION PATTERNS
-- ============================================================
CREATE TABLE correlation_patterns (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT UNIQUE NOT NULL,
  description           TEXT NOT NULL,
  signals_required      JSONB NOT NULL,
  min_signals_match     INTEGER DEFAULT 2,
  severity              alert_severity NOT NULL,
  time_window_seconds   INTEGER DEFAULT 600,
  is_active             BOOLEAN DEFAULT TRUE,
  fire_count            INTEGER DEFAULT 0,
  true_positive_count   INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS (partitioned by year)
-- ============================================================
CREATE TABLE alerts (
  id                UUID DEFAULT uuid_generate_v4(),
  rule_id           UUID REFERENCES detection_rules(id),
  pattern_id        UUID REFERENCES correlation_patterns(id),
  protocol_id       UUID REFERENCES protocols(id),
  severity          alert_severity NOT NULL,
  status            alert_status DEFAULT 'FIRING',
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  signal_snapshot   JSONB NOT NULL,
  affected_protocols UUID[] DEFAULT '{}',
  onchain_signature TEXT,
  subscriber_count  INTEGER DEFAULT 0,
  acknowledged_by   UUID,
  acknowledged_at   TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  fired_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, fired_at)
) PARTITION BY RANGE (fired_at);

CREATE TABLE alerts_2025 PARTITION OF alerts FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE alerts_2026 PARTITION OF alerts FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE alerts_2027 PARTITION OF alerts FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX idx_alerts_protocol_time ON alerts(protocol_id, fired_at DESC);
CREATE INDEX idx_alerts_severity      ON alerts(severity, status);
CREATE INDEX idx_alerts_firing        ON alerts(status) WHERE status = 'FIRING';

-- ============================================================
-- CANARY NODES
-- ============================================================
CREATE TABLE canary_nodes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id           TEXT UNIQUE NOT NULL,
  wallet_address    TEXT UNIQUE NOT NULL,
  api_key_hash      TEXT NOT NULL,
  reputation_score  NUMERIC DEFAULT 50.0 CHECK (reputation_score BETWEEN 0 AND 100),
  total_reports     INTEGER DEFAULT 0,
  accurate_reports  INTEGER DEFAULT 0,
  false_reports     INTEGER DEFAULT 0,
  last_seen_at      TIMESTAMPTZ,
  status            canary_status DEFAULT 'PENDING',
  geographic_region TEXT,
  version           TEXT,
  metadata          JSONB DEFAULT '{}',
  registered_at     TIMESTAMPTZ DEFAULT NOW(),
  banned_reason     TEXT
);

CREATE INDEX idx_canary_status     ON canary_nodes(status);
CREATE INDEX idx_canary_reputation ON canary_nodes(reputation_score DESC);
CREATE INDEX idx_canary_wallet     ON canary_nodes(wallet_address);

-- ============================================================
-- CANARY REPORTS (partitioned)
-- ============================================================
CREATE TABLE canary_reports (
  id            UUID DEFAULT uuid_generate_v4(),
  canary_id     UUID REFERENCES canary_nodes(id) ON DELETE CASCADE,
  protocol_id   UUID REFERENCES protocols(id),
  probe_name    TEXT NOT NULL,
  success       BOOLEAN NOT NULL,
  latency_ms    INTEGER CHECK (latency_ms >= 0),
  error_code    TEXT,
  error_message TEXT,
  raw_result    JSONB DEFAULT '{}',
  signature     TEXT NOT NULL,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, reported_at)
) PARTITION BY RANGE (reported_at);

CREATE TABLE canary_reports_2025 PARTITION OF canary_reports FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE canary_reports_2026 PARTITION OF canary_reports FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_canary_reports_protocol ON canary_reports(protocol_id, reported_at DESC);
CREATE INDEX idx_canary_reports_canary   ON canary_reports(canary_id, reported_at DESC);
CREATE INDEX idx_canary_reports_failure  ON canary_reports(reported_at DESC) WHERE success = FALSE;

-- ============================================================
-- CANARY CONSENSUS
-- ============================================================
CREATE TABLE canary_consensus (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id       UUID REFERENCES protocols(id),
  probe_name        TEXT NOT NULL,
  window_start      TIMESTAMPTZ NOT NULL,
  window_end        TIMESTAMPTZ NOT NULL,
  total_reports     INTEGER NOT NULL,
  failure_count     INTEGER NOT NULL,
  failure_rate      NUMERIC NOT NULL CHECK (failure_rate BETWEEN 0 AND 1),
  avg_latency_ms    NUMERIC,
  consensus_reached BOOLEAN DEFAULT FALSE,
  alert_triggered   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consensus_protocol ON canary_consensus(protocol_id, window_start DESC);
CREATE INDEX idx_consensus_alert    ON canary_consensus(alert_triggered) WHERE alert_triggered = TRUE;

-- ============================================================
-- SUBSCRIBERS
-- ============================================================
CREATE TABLE subscribers (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address          TEXT,
  email                   TEXT,
  nickname                TEXT,
  global_min_severity     alert_severity DEFAULT 'P2',
  digest_mode             BOOLEAN DEFAULT FALSE,
  is_active               BOOLEAN DEFAULT TRUE,
  wallet_last_scanned_at  TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user UNIQUE (user_id)
);

CREATE INDEX idx_subscribers_wallet ON subscribers(wallet_address);
CREATE INDEX idx_subscribers_active ON subscribers(is_active) WHERE is_active = TRUE;

-- ============================================================
-- SUBSCRIPTION CHANNELS
-- ============================================================
CREATE TABLE subscription_channels (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscriber_id  UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  channel        notification_channel NOT NULL,
  destination    TEXT NOT NULL,
  is_verified    BOOLEAN DEFAULT FALSE,
  is_active      BOOLEAN DEFAULT TRUE,
  min_severity   alert_severity DEFAULT 'P2',
  config         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_channel_dest UNIQUE (subscriber_id, channel, destination)
);

CREATE INDEX idx_channels_subscriber ON subscription_channels(subscriber_id);
CREATE INDEX idx_channels_active     ON subscription_channels(is_active) WHERE is_active = TRUE;

-- ============================================================
-- PROTOCOL SUBSCRIPTIONS
-- ============================================================
CREATE TABLE protocol_subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscriber_id    UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  protocol_id      UUID REFERENCES protocols(id) ON DELETE CASCADE,
  min_severity     alert_severity DEFAULT 'P2',
  auto_detected    BOOLEAN DEFAULT FALSE,
  wallet_exposure  JSONB DEFAULT '{}',
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_sub_protocol UNIQUE (subscriber_id, protocol_id)
);

CREATE INDEX idx_proto_subs_subscriber ON protocol_subscriptions(subscriber_id);
CREATE INDEX idx_proto_subs_protocol   ON protocol_subscriptions(protocol_id);

-- ============================================================
-- NOTIFICATION LOG (partitioned)
-- ============================================================
CREATE TABLE notification_log (
  id            UUID DEFAULT uuid_generate_v4(),
  alert_id      UUID NOT NULL,
  subscriber_id UUID REFERENCES subscribers(id),
  channel       notification_channel NOT NULL,
  destination   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'deduped', 'queued')),
  attempt_count INTEGER DEFAULT 1,
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, sent_at)
) PARTITION BY RANGE (sent_at);

CREATE TABLE notification_log_2025 PARTITION OF notification_log FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE notification_log_2026 PARTITION OF notification_log FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_notif_log_alert      ON notification_log(alert_id, sent_at DESC);
CREATE INDEX idx_notif_log_subscriber ON notification_log(subscriber_id, sent_at DESC);

-- ============================================================
-- SIGNAL BASELINES
-- ============================================================
CREATE TABLE signal_baselines (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id  UUID REFERENCES protocols(id) ON DELETE CASCADE,
  signal_type  signal_type NOT NULL,
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
CREATE TABLE alert_dedup (
  dedup_key  TEXT PRIMARY KEY,
  alert_id   UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dedup_expires ON alert_dedup(expires_at);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID,
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('user', 'canary', 'system', 'edge_function')),
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor  ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);

-- ============================================================
-- SYSTEM HEALTH
-- ============================================================
CREATE TABLE system_health (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  last_run_at     TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  error_message   TEXT,
  metrics         JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_component UNIQUE (component)
);

-- ============================================================
-- VIEWS
-- ============================================================
CREATE VIEW v_active_alerts AS
SELECT
  a.id, a.severity, a.status, a.title, a.description,
  a.signal_snapshot, a.subscriber_count, a.fired_at,
  p.name AS protocol_name, p.slug AS protocol_slug,
  p.category AS protocol_category, p.logo_url
FROM alerts a
JOIN protocols p ON p.id = a.protocol_id
WHERE a.status = 'FIRING'
ORDER BY
  CASE a.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
  a.fired_at DESC;

CREATE VIEW v_protocol_health AS
SELECT
  p.id, p.slug, p.name, p.category,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'FIRING' AND a.severity = 'P1') AS active_p1,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'FIRING' AND a.severity = 'P2') AS active_p2,
  MAX(a.fired_at) AS last_alert_at,
  (SELECT COUNT(*) FROM canary_consensus cc
   WHERE cc.protocol_id = p.id AND cc.alert_triggered = TRUE
   AND cc.window_start > NOW() - INTERVAL '1 hour') AS canary_failures_1h
FROM protocols p
LEFT JOIN alerts a ON a.protocol_id = p.id AND a.fired_at > NOW() - INTERVAL '24 hours'
WHERE p.is_active = TRUE
GROUP BY p.id, p.slug, p.name, p.category;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE protocols              ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlation_patterns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_nodes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_consensus       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_baselines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_dedup            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health          ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ policies
CREATE POLICY "protocols_public_read"          ON protocols             FOR SELECT USING (TRUE);
CREATE POLICY "signals_public_read"            ON signals               FOR SELECT USING (TRUE);
CREATE POLICY "alerts_public_read"             ON alerts                FOR SELECT USING (TRUE);
CREATE POLICY "canary_consensus_public_read"   ON canary_consensus      FOR SELECT USING (TRUE);
CREATE POLICY "baselines_public_read"          ON signal_baselines      FOR SELECT USING (TRUE);
CREATE POLICY "system_health_public_read"      ON system_health         FOR SELECT USING (TRUE);
CREATE POLICY "rules_public_read"              ON detection_rules       FOR SELECT USING (TRUE);
CREATE POLICY "patterns_public_read"           ON correlation_patterns  FOR SELECT USING (TRUE);

-- SERVICE_ROLE WRITE policies (edge functions use service_role)
CREATE POLICY "protocols_service_write"        ON protocols             FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "signals_service_insert"         ON signals               FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "alerts_service_write"           ON alerts                FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "canary_nodes_service_all"       ON canary_nodes          FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "canary_reports_service"         ON canary_reports        FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "canary_consensus_service_write" ON canary_consensus      FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "baselines_service_write"        ON signal_baselines      FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "audit_service_only"             ON audit_log             FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "system_health_service_write"    ON system_health         FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "rules_service_write"            ON detection_rules       FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "patterns_service_write"         ON correlation_patterns  FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "dedup_service_only"             ON alert_dedup           FOR ALL    USING (auth.role() = 'service_role');

-- USER-SCOPED policies
CREATE POLICY "subscribers_own" ON subscribers
  FOR ALL USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "channels_own" ON subscription_channels
  FOR ALL USING (
    subscriber_id IN (SELECT id FROM subscribers WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY "proto_subs_own" ON protocol_subscriptions
  FOR ALL USING (
    subscriber_id IN (SELECT id FROM subscribers WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY "notif_log_own" ON notification_log
  FOR SELECT USING (
    subscriber_id IN (SELECT id FROM subscribers WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protocols_updated_at  BEFORE UPDATE ON protocols  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscribers_updated_at BEFORE UPDATE ON subscribers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION compute_zscore(
  p_protocol_id UUID, p_signal_type signal_type,
  p_value NUMERIC, p_window TEXT DEFAULT '24h'
) RETURNS NUMERIC AS $$
DECLARE v_mean NUMERIC; v_stddev NUMERIC;
BEGIN
  IF p_window = '1h' THEN
    SELECT mean_1h, stddev_1h INTO v_mean, v_stddev FROM signal_baselines WHERE protocol_id = p_protocol_id AND signal_type = p_signal_type;
  ELSIF p_window = '7d' THEN
    SELECT mean_7d, stddev_7d INTO v_mean, v_stddev FROM signal_baselines WHERE protocol_id = p_protocol_id AND signal_type = p_signal_type;
  ELSE
    SELECT mean_24h, stddev_24h INTO v_mean, v_stddev FROM signal_baselines WHERE protocol_id = p_protocol_id AND signal_type = p_signal_type;
  END IF;
  IF v_stddev IS NULL OR v_stddev = 0 THEN RETURN NULL; END IF;
  RETURN (p_value - v_mean) / v_stddev;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_alert_deduped(p_rule_id UUID, p_protocol_id UUID) RETURNS BOOLEAN AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM alert_dedup
  WHERE dedup_key = p_rule_id::TEXT || ':' || p_protocol_id::TEXT AND expires_at > NOW();
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION clean_expired_dedup() RETURNS VOID AS $$
BEGIN DELETE FROM alert_dedup WHERE expires_at < NOW(); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_alert_subscribers(p_protocol_id UUID, p_severity alert_severity)
RETURNS TABLE (subscriber_id UUID, channel notification_channel, destination TEXT, config JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT sc.subscriber_id, sc.channel, sc.destination, sc.config
  FROM subscription_channels sc
  JOIN subscribers s ON s.id = sc.subscriber_id
  JOIN protocol_subscriptions ps ON ps.subscriber_id = sc.subscriber_id
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- PG_CRON JOBS
-- ============================================================
SELECT cron.schedule('refresh-baselines',   '*/5 * * * *',  $$ SELECT refresh_signal_baseline(p.id, s.signal_type::signal_type) FROM protocols p CROSS JOIN (SELECT DISTINCT signal_type FROM signals WHERE recorded_at > NOW() - INTERVAL '1 hour') s WHERE p.is_active = TRUE; $$);
SELECT cron.schedule('clean-dedup',          '*/10 * * * *', $$ SELECT clean_expired_dedup(); $$);
SELECT cron.schedule('auto-resolve-stale',   '*/30 * * * *', $$ UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE status = 'FIRING' AND severity IN ('P3','INFO') AND fired_at < NOW() - INTERVAL '2 hours'; $$);
SELECT cron.schedule('system-heartbeat',     '* * * * *',    $$ INSERT INTO system_health (component,status,last_run_at,updated_at) VALUES ('database','healthy',NOW(),NOW()) ON CONFLICT (component) DO UPDATE SET status='healthy',last_run_at=NOW(),updated_at=NOW(); $$);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO protocols (slug, name, category, program_address, defillama_slug) VALUES
  ('raydium',     'Raydium',          'DEX',            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'raydium'),
  ('orca',        'Orca',             'DEX',            'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  'orca'),
  ('wormhole',    'Wormhole',         'BRIDGE',         'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',  'wormhole'),
  ('debridge',    'deBridge',         'BRIDGE',         'DEbrdGj3HsRsAzx6uH4MKyREKxVAfBydijLUF3ygsFfh', 'debridge'),
  ('pyth',        'Pyth Network',     'ORACLE',         'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH',  'pyth-network'),
  ('switchboard', 'Switchboard',      'ORACLE',         'SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f',   'switchboard'),
  ('marinade',    'Marinade Finance', 'LIQUID_STAKING', 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',  'marinade-finance'),
  ('jito',        'Jito',             'LIQUID_STAKING', 'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb',  'jito'),
  ('jupiter',     'Jupiter',          'DEX',            'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  'jupiter'),
  ('drift',       'Drift Protocol',   'DEX',            'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',  'drift-protocol'),
  ('mango',       'Mango Markets',    'LENDING',        '4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg', 'mango-markets'),
  ('kamino',      'Kamino Finance',   'LENDING',        'KLend2g3cP87fffoy8q1mQqGKjrL1AyFArkvfnpjeqM',  'kamino-finance'),
  ('helius',      'Helius RPC',       'RPC',            NULL, NULL),
  ('triton',      'Triton RPC',       'RPC',            NULL, NULL);

INSERT INTO detection_rules (name, description, signal_type, threshold_pct, window_seconds, min_occurrences, severity, cooldown_seconds) VALUES
  ('tvl_drop_15_5min',     'TVL drops >15% in 5 minutes',       'TVL_DROP',            0.15, 300,  1, 'P2', 600),
  ('tvl_drop_30_10min',    'TVL drops >30% in 10 minutes',      'TVL_DROP',            0.30, 600,  1, 'P1', 1800),
  ('oracle_stale_45s',     'Oracle feed not updated in 45s',    'ORACLE_STALENESS',    NULL, 45,   2, 'P1', 300),
  ('oracle_deviation_5pct','Oracle price deviation >5%',        'ORACLE_DEVIATION',    0.05, 60,   1, 'P2', 300),
  ('validator_skip_25pct', 'Validator skip rate >25%',          'VALIDATOR_SKIP_RATE', 0.25, 3600, 2, 'P2', 1800),
  ('slot_lag_500ms',       'Slot confirmation lag >500ms',      'SLOT_LAG',            NULL, 120,  3, 'P2', 600),
  ('liquidity_drain_20pct','Pool liquidity drops >20% in 10min','LIQUIDITY_DRAIN',     0.20, 600,  1, 'P2', 900),
  ('bridge_imbalance_40pct','Bridge lock/unlock imbalance >40%','BRIDGE_IMBALANCE',    0.40, 1800, 1, 'P1', 3600),
  ('tx_failure_spike_40pct','Transaction failure rate >40%',    'TX_FAILURE_SPIKE',    0.40, 300,  2, 'P2', 600),
  ('canary_failure_60pct', '3+ canaries reporting failure',     'CANARY_PROBE_FAILURE',0.60, 300,  1, 'P2', 600),
  ('rpc_latency_5s',       'RPC response time >5 seconds',      'RPC_LATENCY_SPIKE',   NULL, 180,  3, 'P3', 300);

INSERT INTO correlation_patterns (name, description, signals_required, min_signals_match, severity, time_window_seconds) VALUES
  ('bridge_failure_incoming','Bridge drain pre-failure signature',
   '[{"signal_type":"TVL_DROP","threshold_pct":0.15},{"signal_type":"ORACLE_DEVIATION","threshold_pct":0.03},{"signal_type":"TX_FAILURE_SPIKE","threshold_pct":0.30}]'::JSONB,
   2,'P1',600),
  ('dex_liquidity_crisis','DEX liquidity exit compound signal',
   '[{"signal_type":"LIQUIDITY_DRAIN","threshold_pct":0.20},{"signal_type":"PRICE_IMPACT_INCREASE","threshold_factor":2.0},{"signal_type":"TVL_DROP","threshold_pct":0.15}]'::JSONB,
   2,'P1',600),
  ('validator_cascade_risk','Validator cluster instability signature',
   '[{"signal_type":"VALIDATOR_SKIP_RATE","threshold_pct":0.20},{"signal_type":"SLOT_LAG","threshold_ms":300},{"signal_type":"STAKE_SHIFT","threshold_pct":0.05}]'::JSONB,
   2,'P1',1800),
  ('oracle_manipulation','Slow oracle price manipulation pattern',
   '[{"signal_type":"ORACLE_DEVIATION","rate_per_minute":0.005},{"signal_type":"TX_FAILURE_SPIKE","threshold_pct":0.10}]'::JSONB,
   2,'P1',900);

INSERT INTO system_health (component, status) VALUES
  ('ingestion',   'healthy'),
  ('detection',   'healthy'),
  ('notification','healthy'),
  ('canary',      'healthy'),
  ('database',    'healthy');
