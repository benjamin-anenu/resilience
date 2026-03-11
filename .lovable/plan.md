

# Aegis: End-to-End System Audit & Adversarial Analysis

## What Aegis Actually Is

Aegis is a decentralized early-warning system for the Solana ecosystem. It monitors ~14 protocols across DeFi, bridges, oracles, and validators, combining automated signal ingestion with crowdsourced "canary" probes to detect anomalies and alert subscribers.

The system has four core subsystems:

```text
┌─────────────────────────────────────────────────────────────┐
│                     AEGIS ARCHITECTURE                      │
│                                                             │
│  1. DETECTION ENGINE (cron, every 60s)                      │
│     └─ Ingests from 6 sources:                              │
│        DeFiLlama TVL, Jupiter prices, Solana RPC perf,      │
│        Pyth oracle feeds, Validators.app, Bridge volumes    │
│     └─ Writes signals to DB                                 │
│     └─ Runs Rule Engine (threshold + Z-score triggers)      │
│     └─ Runs Correlation Engine (multi-signal patterns)      │
│     └─ Fires alerts on matches                              │
│                                                             │
│  2. CANARY NETWORK (crowdsourced probes)                    │
│     └─ Community registers nodes (wallet + node_id)         │
│     └─ Nodes submit probe reports (browser or CLI)          │
│     └─ canary-ingest validates, builds 5-min consensus      │
│     └─ 60% failure threshold → triggers alert               │
│     └─ Reputation system: agree=+0.5, disagree=-2.0         │
│                                                             │
│  3. ALERT ROUTER (fan-out on alert fire)                    │
│     └─ Queries subscribers via get_alert_subscribers()       │
│     └─ Delivers to: Telegram, Discord, Email, Webhook, ntfy │
│     └─ Writes on-chain Memo tx for P1/P2 alerts             │
│     └─ Logs all delivery attempts                           │
│                                                             │
│  4. SUBSCRIPTION MANAGER (wallet-native)                    │
│     └─ Scans wallet token holdings + tx history             │
│     └─ Auto-detects protocol exposure                       │
│     └─ Upserts subscriber + channels + protocol subs        │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Loopholes & Failure Modes

### 1. SECURITY: Canary Probes Are Trivially Spammable (P0)

**Problem:** Browser probes bypass Ed25519 signature verification entirely. The only check is `report.signature.startsWith("browser-")`. The API key provided in the form is **never validated** — the `canary-ingest` function doesn't check it at all. It only looks up the canary node by `node_id`, which is publicly readable from the `canary_nodes` table (RLS allows public SELECT).

**Impact:** Anyone can:
- Look up any active `node_id` from the public `canary_nodes` table
- Submit fake probes claiming failures for any protocol
- With 3+ fake nodes, trigger consensus → fire real P1/P2 alerts
- Alert spam to Telegram/Discord channels of real subscribers
- Trigger on-chain Memo transactions (costs real SOL from the `AEGIS_ONCHAIN_KEYPAIR`)

**Specific attack:** Register 3 nodes (free, auto-approved) → submit coordinated failure probes → consensus threshold met → real alerts fire.

### 2. SECURITY: API Key Is Collected But Never Verified (P0)

The `CanaryProbeSubmission` component collects an API key in the form, but the `canary-ingest` edge function **never receives or validates it**. The `api_key_hash` stored during registration is never compared against anything during probe submission. The API key field is pure security theater.

### 3. SECURITY: No Authentication on Subscription Manager (P1)

The `manage-aegis-subscriptions` function accepts any `wallet_address` string with zero proof of ownership. An attacker can:
- Subscribe any wallet address to spam channels
- Overwrite an existing subscriber's notification channels (the function does `delete` then `insert` on channels)
- Unsubscribe anyone by passing their wallet address

### 4. SECURITY: Probes Always Report `success: true` (P1)

In `CanaryProbeSubmission.tsx` line 78: `success: true` is hardcoded. The browser UI cannot report actual failures. This means the browser probe submission is functionally useless for its stated purpose — detecting protocol failures.

### 5. RELIABILITY: Detection Engine Depends on Free/Public APIs (P2)

- `api.mainnet-beta.solana.com` — heavily rate-limited public RPC
- `rpc.ankr.com/solana` — free tier with limits
- `validators.app` — no token configured (secret `VALIDATORS_APP_TOKEN` not in secrets list)
- If DeFiLlama goes down, TVL signals disappear silently

The system degrades silently. No alerts fire ≠ "everything is fine."

### 6. RELIABILITY: No Cron Job Configured for Detection Engine

The detection engine comment says "Triggered every 60s via external cron" but there's no evidence of a pg_cron setup or external scheduler. If nobody calls it, the entire automated detection pipeline doesn't run. The system health dashboard would show stale timestamps but users might not notice.

### 7. DATA: Canary Registration Auto-Approves with ACTIVE Status

Nodes register as `ACTIVE` immediately. Combined with the signature bypass for browser probes and no API key validation, the barrier to sybil-attacking the canary network is zero.

### 8. DATA: Consensus Window Is Too Narrow

The 5-minute sliding window for consensus means probes must arrive nearly simultaneously. With few canary operators, consensus may never be reached legitimately, making the canary network effectively inert. Conversely, a coordinated attacker can trivially time 3 probes within 5 minutes.

### 9. UX: Missing `aegis_subscribers` Table

The `manage-aegis-subscriptions` function references an `aegis_subscribers` table that doesn't appear in the provided database schema. If this table doesn't exist, the entire subscription flow will fail with a database error.

### 10. UX: On-Chain Receipts Will Fail Silently

The `AEGIS_ONCHAIN_KEYPAIR` secret is not in the secrets list. On-chain memo transactions will silently fail for every P1/P2 alert. The code catches the error and logs it, but users are told alerts are "written on-chain" with no actual delivery.

### 11. UX: Email Delivery Will Fail

`RESEND_API_KEY` is not in the secrets list. Any subscriber choosing email notifications will have all deliveries fail. The notification log will record `"RESEND_API_KEY not set"` but the user has no visibility into this.

---

## Recommendations

### Immediate (do now)
1. **Validate API keys in canary-ingest** — hash the submitted key and compare against `api_key_hash` in the `canary_nodes` record
2. **Require wallet signature for subscriptions** — verify the wallet actually signed a message before allowing subscribe/unsubscribe
3. **Fix hardcoded `success: true`** — let users toggle probe result in the browser UI
4. **Verify `aegis_subscribers` table exists** — if not, create it

### Short-term
5. **Rate-limit probe submissions per node** — e.g., max 1 probe per protocol per 2 minutes
6. **Add a "last detection run" indicator** — so users know if the engine is actually running
7. **Configure missing secrets** — `RESEND_API_KEY`, `AEGIS_ONCHAIN_KEYPAIR`, or remove references to features that aren't operational
8. **Hide `wallet_address` from public canary_nodes reads** — currently fully exposed via public SELECT RLS

### Architectural
9. **Increase consensus minimum** — 3 nodes is far too low; require 5+ for P1/P2 severity alerts
10. **Add proof-of-work or stake requirement** for canary registration to prevent sybil attacks
11. **Implement monitoring for the monitor** — an external health check that verifies the detection engine is actually running

---

## Honest Assessment

The architecture is ambitious and well-structured in concept: detection engine + canary consensus + multi-channel routing + on-chain immutability. The code quality is high.

However, the system currently has **zero meaningful authentication on its most critical paths**. The canary network can be trivially sybiled. The subscription manager can be hijacked. The API key is collected but not checked. Several advertised features (on-chain receipts, email delivery) are non-functional due to missing secrets.

The most dangerous aspect: the system *looks* operational and trustworthy from the UI, but the security model has fundamental gaps that would allow a moderately skilled attacker to trigger false alerts across all subscriber channels within minutes.

**Bottom line:** Before promoting Aegis publicly, the API key validation and probe authentication issues must be resolved. Everything else is polish — these are structural integrity problems.

