

# Aegis Implementation Status + Next Phases Plan

## What's Been Built (Confirmed in Codebase)

### Database Layer (16 Aegis tables live)
- `protocols` — 14 seeded Solana protocols (Raydium, Orca, Wormhole, Pyth, Jupiter, etc.)
- `signals`, `detection_rules`, `correlation_patterns`, `alerts`, `alert_dedup`
- `canary_nodes`, `canary_reports`, `canary_consensus`
- `aegis_subscribers`, `aegis_subscription_channels`, `aegis_protocol_subscriptions`
- `aegis_notification_log`, `signal_baselines`, `aegis_audit_log`, `aegis_system_health`
- Views: `v_active_alerts`, `v_protocol_health`
- DB functions: `compute_zscore`, `is_alert_deduped`, `clean_expired_dedup`, `get_alert_subscribers`
- All tables have RLS enabled with public read + service_role write policies

### Edge Functions (3 deployed)
- **detection-engine** — 6 ingestors (DeFiLlama TVL, Jupiter prices, Solana RPC, Pyth oracles, Validators.app, DeFiLlama bridges), rule engine, correlation engine, alert firing. CORS + cron secret auth.
- **alert-router** — Fan-out to Telegram, Discord, Email (Resend), Webhooks (HMAC-signed), ntfy.sh push. Batch processing, dedup, notification logging.
- **canary-ingest** — Ed25519 signature verification, reputation scoring, consensus building (5-min windows, 60% threshold), auto-suspend low-rep canaries.

### Frontend
- `/aegis` page with SystemHealthBar, ProtocolHealthGrid, AlertFeed (realtime), CanaryStatus components
- Navigation link in both desktop and mobile nav

### Secrets Configured
- `AEGIS_CRON_SECRET` — set

### What's NOT Yet Done (from uploaded blueprint)
1. **Notification secrets** — `TELEGRAM_BOT_TOKEN` and `RESEND_API_KEY` not set (alert delivery won't work)
2. **pg_cron jobs** — The SQL schema references 4 cron jobs (baseline refresh, dedup cleanup, auto-resolve stale alerts, system heartbeat) but these haven't been created via `cron.schedule`
3. **Detection engine cron trigger** — No automatic 60-second invocation set up yet
4. **Uploaded files differ from deployed** — The uploaded versions (index.ts, index_1.ts, index_2.ts) reference `system_health` and `notification_log` table names, while deployed code correctly uses `aegis_system_health` and `aegis_notification_log`. The deployed versions are correct.
5. **Canary script (aegis-canary.js)** — External artifact, not deployable via Lovable
6. **Wallet-native subscriptions** (Layer 4) — Not built
7. **On-chain alert receipts** (Layer 5) — Not built
8. **Signals table** — The blueprint uses partitioned tables, but Lovable Cloud uses regular tables (already adapted correctly)

---

## Phase Plan: Remaining Implementation

### Phase 1: Make Current System Operational
**Goal: Get the detection engine running automatically and alerts delivering**

1. **Set up pg_cron for detection engine** — Schedule `net.http_post` to invoke detection-engine every 60 seconds using the `AEGIS_CRON_SECRET` header
2. **Set up maintenance cron jobs** — Dedup cleanup (every 10 min), auto-resolve stale P3/INFO alerts (every 30 min), system heartbeat (every 1 min)
3. **Create baseline refresh function** — SQL function to recalculate signal baselines from recent data, scheduled every 5 minutes
4. **Request notification secrets** — Prompt for `TELEGRAM_BOT_TOKEN` and `RESEND_API_KEY` so alert-router can actually deliver

### Phase 2: Wallet-Native Subscriptions (Layer 4)
**Goal: Connect wallet, auto-detect on-chain positions, auto-subscribe to relevant alerts**

1. **Create subscription management edge function** — Accept wallet address, scan token holdings via Helius DAS API (free tier), map positions to monitored protocols, create/update subscriber + protocol_subscriptions records
2. **Build subscription UI page** — Wallet connect flow, show detected positions, protocol subscription toggles, channel configuration (Telegram chat ID, Discord webhook, email)
3. **Add "Subscribe" CTA to Aegis page** — Prominent call-to-action for wallet-native onboarding
4. **Periodic wallet re-scan** — Edge function to refresh wallet positions every 24h, update subscriptions

### Phase 3: Enhanced Aegis Dashboard
**Goal: Make the Aegis page a standalone, information-rich experience**

1. **Signal history charts** — Time-series visualization of ingested signals per protocol (TVL, oracle freshness, etc.)
2. **Alert detail view** — Click into an alert to see signal snapshot, affected protocols, subscriber count, timeline
3. **Canary network map** — Geographic distribution of active canary nodes, reputation leaderboard
4. **Protocol detail drill-down** — Click a protocol card to see its signal history, alert history, canary coverage
5. **Incident timeline** — Historical view of all resolved incidents with root cause correlation

### Phase 4: On-Chain Alert Receipts (Layer 5)
**Goal: Write alert proofs on-chain for immutability**

1. **Anchor program for alert receipts** — Compressed state accounts storing alert hash, timestamp, severity, protocol, subscriber count
2. **Edge function integration** — After alert fires, async-write receipt on-chain via Solana RPC
3. **Receipt verification UI** — Show on-chain tx signature for each alert, link to Solscan
4. **Public alert history API** — SSE-based public status page that reads from both DB and on-chain

### Phase 5: Community & Governance
**Goal: Open up the system for community participation**

1. **Canary registration page** — Register a canary node with wallet, get API key, download script
2. **Detection rule proposals** — Community can propose new detection rules via governance
3. **Correlation pattern proposals** — Submit new correlation patterns with backtesting
4. **Canary reputation dashboard** — Public leaderboard of canary operators

---

## Recommended Implementation Order

Start with **Phase 1** (operational cron + notification secrets) since everything else depends on the detection engine actually running. Then **Phase 2** (wallet subscriptions) delivers the core "blue ocean" user-facing feature. Phase 3 enriches the dashboard. Phases 4-5 are longer-term infrastructure plays.

