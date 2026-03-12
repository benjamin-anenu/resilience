

# Aegis Security Hardening — Round 3

## Status: ✅ COMPLETED

### Round 3 Changes (This Update)

#### 1. **Detection Engine Cron Auth Fix**
- Root cause: Vault `AEGIS_CRON_SECRET` and edge function env secret were out of sync → silent 401 every 60s
- Fix: Added anon key acceptance to detection engine auth (same pattern as all other cron jobs)
- Recreated cron job with `Authorization: Bearer <anon_key>` — no vault dependency
- `X-Aegis-Cron-Secret` and `Bearer <service_role_key>` still accepted as fallback auth

#### 2. **Detection Engine Hardening**
- Added structured logging: auth failures, run start/end, signal counts, duration
- Added per-ingestor error logging via `Promise.allSettled` result inspection
- Each ingestor's success/failure count now logged individually

#### 3. **Alert Router Hardening**
- Added UUID format validation on `alert_id` (regex check)
- Added JSON parse error handling (was uncaught)
- Added structured logging: auth failures, alert processing start, delivery summary

#### 4. **Canary Ingest Hardening**
- Added `raw_result` payload size limit (rejects > 10KB with 413)
- Added IP address extraction (`x-forwarded-for` / `cf-connecting-ip`)
- All audit log entries now include `ip_address` field

### Previous Rounds
- Round 1: API key validation, PENDING status, rate limiting, consensus minimum
- Round 2: `canary_nodes_public` view, protocol-scoped rate limits, alert-router memory leak fix

### Remaining Known Gaps (Deferred)

| Gap | Severity | Status |
|-----|----------|--------|
| Subscription manager lacks wallet signature auth | P1 | Deferred — requires client-side signing UX |
| Missing secret: `RESEND_API_KEY` | P2 | Requires user to provide key |
| Email `from:` address `alerts@aegis.build` not configured in Resend | P2 | Requires Resend domain verification |
| Discord webhook URL not validated | P3 | Low risk — fails gracefully |
