

# Aegis Phase 1: Foundation

## Overview
Deploy the Aegis database schema, 3 core edge functions, add "AEGIS" as a standalone nav item, and build the Aegis dashboard page with live alert feed, protocol health grid, and canary network status.

## Schema Modifications

The uploaded SQL has ~594 lines creating 16 tables. Several adjustments needed for Lovable Cloud compatibility:

- **Remove** `pg_cron` and `pg_stat_statements` extension calls (not available via migration tool; cron jobs will be set up separately via insert tool)
- **Remove** `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` and `"pgcrypto"` (already available)
- **Remove** partitioned tables — use regular tables instead (partitioning requires superuser privileges not available in Lovable Cloud). Add indexes on timestamp columns for performance
- **Remove** `auth.users` foreign key on `subscribers.user_id` — store as TEXT instead (consistent with existing app pattern of X/wallet-based auth, not Supabase Auth)
- **Remove** `CHECK` constraints — use validation triggers instead (per guidelines)
- **Keep** all RLS policies, views, functions, and seed data

Tables to create: `protocols`, `signals`, `detection_rules`, `correlation_patterns`, `alerts`, `canary_nodes`, `canary_reports`, `canary_consensus`, `subscribers`, `subscription_channels`, `protocol_subscriptions`, `notification_log`, `signal_baselines`, `alert_dedup`, `audit_log`, `system_health`

Views: `v_active_alerts`, `v_protocol_health`

Functions: `compute_zscore`, `is_alert_deduped`, `clean_expired_dedup`, `get_alert_subscribers`

## Edge Functions (3)

### 1. `detection-engine/index.ts`
From uploaded `index_1.ts` (535 lines). Ingests from DeFiLlama, Jupiter, Solana RPC, Pyth Hermes, Validators.app. Runs Z-score enrichment, rule engine, correlation engine. Config in `config.toml` with `verify_jwt = false`.

### 2. `alert-router/index.ts`
From uploaded `index.ts` (415 lines). Fans out alerts to Telegram, Discord, Email (Resend), Webhooks, Push (ntfy.sh). Logs delivery attempts.

### 3. `canary-ingest/index.ts`
From uploaded `index_2.ts` (430 lines). Validates Ed25519 signatures, runs consensus aggregation, manages canary reputation.

All three need CORS headers added and minor adjustments for the project's Supabase URL/keys pattern.

## Secrets Required
- `AEGIS_CRON_SECRET` — auth token for cron-triggered detection engine calls
- `TELEGRAM_BOT_TOKEN` — optional, for Telegram alerts
- `RESEND_API_KEY` — optional, for email alerts

## Navigation Update

Add "AEGIS" as a standalone top-level nav item (like README and LEADERBOARD), with a Shield icon, linking to `/aegis`. Position it prominently between LEADERBOARD and the dropdown groups.

## Frontend: `/aegis` Dashboard Page

**File**: `src/pages/Aegis.tsx`

Three sections:

### Section 1: Hero + System Status Bar
- "AEGIS — Solana Early Warning System" header
- System health indicators (4 components: ingestion, detection, notification, canary)
- Live stats: total protocols monitored, active alerts, canary nodes online

### Section 2: Protocol Health Grid
- Card grid of 14 seeded protocols
- Each card shows: name, category badge, active P1/P2 count, last alert time, canary failure rate
- Color-coded: green (healthy), yellow (P3 active), orange (P2), red (P1)
- Data from `v_protocol_health` view via Supabase Realtime subscription

### Section 3: Live Alert Feed
- Reverse-chronological feed of recent alerts
- Severity badges (P1 red, P2 orange, P3 yellow, INFO blue)
- Protocol name, title, description, timestamp
- Data from `v_active_alerts` view with Realtime subscription for live updates

### Section 4: Canary Network Status
- Total active canaries, geographic distribution
- Top canaries by reputation score (leaderboard)
- "Run a Canary Node" CTA linking to docs/GitHub

## Component Files
- `src/pages/Aegis.tsx` — main page
- `src/components/aegis/ProtocolHealthGrid.tsx`
- `src/components/aegis/AlertFeed.tsx`
- `src/components/aegis/CanaryStatus.tsx`
- `src/components/aegis/SystemHealthBar.tsx`
- `src/components/aegis/index.ts`

## Routing
- Add `/aegis` route in `src/App.tsx`
- Add AEGIS nav item in `src/components/layout/Navigation.tsx`

## Implementation Order
1. Run DB migration (adapted schema without partitions/pg_cron)
2. Set up cron jobs via insert tool
3. Deploy 3 edge functions
4. Request secrets (AEGIS_CRON_SECRET)
5. Build Aegis page + components
6. Add route + nav item
7. Enable Realtime on `alerts` and `system_health` tables

