

# Aegis Security Hardening — Round 2

## Status: ✅ COMPLETED

### Round 1 Changes (Previous)
1. **canary-ingest** — API key validation via SHA-256 hash comparison
2. **CanaryProbeSubmission.tsx** — Success/failure toggle, API key sent to backend
3. **register-canary-node** — Nodes start as PENDING
4. **Rate limiting** — 1 probe per node per protocol per 2 minutes
5. **Consensus minimum** — Raised from 3 → 5 canaries

### Round 2 Changes (This Update)

#### 6. **canary_nodes_public view** — Hide sensitive fields
- Created `canary_nodes_public` view exposing only safe columns (no `wallet_address`, `api_key_hash`)
- Locked `canary_nodes` table to `service_role` only for SELECT
- `CanaryStatus.tsx` now queries the safe view instead of the raw table

#### 7. **canary-ingest rate limit fix** — Protocol-scoped
- Rate limit now filters by both `probe_name` AND `protocol_id`
- Previously only filtered by `probe_name`, blocking all probes after hitting limit on one protocol

#### 8. **alert-router memory leak fix**
- `sentThisRun` dedup `Set` was module-level — could grow unboundedly across invocations in Deno Deploy
- Moved to per-request factory function `createLocalDedup()` so each invocation gets a fresh Set

### Remaining Known Gaps (Deferred)

| Gap | Severity | Status |
|-----|----------|--------|
| Subscription manager lacks wallet signature auth | P1 | Deferred — requires client-side signing UX |
| Missing secrets: `RESEND_API_KEY`, `AEGIS_ONCHAIN_KEYPAIR` | P2 | Requires user to provide keys |
| Missing secret: `VALIDATORS_APP_TOKEN` | P3 | Validators.app endpoint works without token (limited) |
| Email `from:` address `alerts@aegis.build` not configured in Resend | P2 | Requires Resend domain verification |
| No pg_cron for detection engine | P2 | Needs external scheduler or pg_cron setup |
| Discord webhook URL not validated | P3 | Low risk — fails gracefully |
