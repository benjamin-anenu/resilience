

# Aegis Hardening Plan

## Current State

The detection engine cron job is running every minute (confirmed via logs — boots every ~60s), but **zero signals are being ingested** and the `aegis_system_health` detection component shows `last_success_at: null`. The function boots, returns a 401, and shuts down silently.

**Root cause**: The cron job reads `AEGIS_CRON_SECRET` from the Postgres vault (`vault.decrypted_secrets`), but the value stored there doesn't match the edge function's `Deno.env.get("AEGIS_CRON_SECRET")`. These are two separate secret stores — vault secrets vs. edge function env secrets — and they were set independently.

## Plan

### 1. Fix Detection Engine Cron Authentication

**Approach**: Remove the vault dependency. Instead, use the `SUPABASE_SERVICE_ROLE_KEY` directly in the cron job's `Authorization` header (same pattern used by all other cron jobs in the project). Update the detection engine to accept `Authorization: Bearer <service_role_key>` — which it already does in its auth check (`authHeader === Bearer ${serviceKey}`). The `X-Aegis-Cron-Secret` path is redundant.

- **Unschedule** the current `aegis-detection-engine` cron job (jobid 18)
- **Reschedule** with `Authorization: Bearer <anon_key>` header — wait, the function checks against `SUPABASE_SERVICE_ROLE_KEY`. The anon key won't work. But we can't put the service role key in a cron SQL statement safely.

**Better approach**: Keep the `X-Aegis-Cron-Secret` vault approach, but ensure the vault secret value matches. We'll update the vault secret to a known value, then update the edge function secret to the same value.

Actually, the simplest fix: update the cron job to use `Authorization: Bearer <service_role_key>` by reading the service role key from vault. Supabase vault always has `service_role_key` available. But actually, looking at the other cron jobs, they hardcode the anon key — those functions verify JWT differently.

**Cleanest approach**: Change the detection engine cron to pass the anon key in the Authorization header, AND update the detection engine code to also accept the anon key with a special cron header, OR simply accept service_role auth. Let me reconsider...

The detection engine already accepts `authHeader === Bearer ${serviceKey}` where `serviceKey = SUPABASE_SERVICE_ROLE_KEY`. So if we can pass the service role key in the cron job, it works. But hardcoding the service role key in SQL is a security concern.

**Final approach**: Use a simple shared secret approach:
1. Delete the vault secret and old cron job
2. Generate a new shared secret value
3. Set it as both the vault secret `AEGIS_CRON_SECRET` and the edge function env secret `AEGIS_CRON_SECRET` to the same value
4. Recreate the cron job reading from vault

Actually, let me simplify. The vault secret exists but we can't read its decrypted value (permission denied). The edge function env has `AEGIS_CRON_SECRET` set. We need them to match. The fix:

1. Delete the existing vault secret
2. Re-insert it with a new known value (e.g., a UUID)
3. Update the edge function secret to the same value
4. Recreate the cron job

### 2. Harden Detection Engine

After fixing auth, apply these hardening improvements:

- **Add structured logging** — currently silent on auth failure (makes debugging impossible). Add `console.log` for key lifecycle events
- **Add error handling per ingestor** — individual ingestor failures should be logged with source name
- **Add health check endpoint** — accept GET requests for health monitoring
- **Timeout protection** — add overall function timeout guard (edge functions have a 60s limit)

### 3. Harden Alert Router

- **Input validation** — validate `alert_id` is a valid UUID format
- **Rate limiting** — prevent duplicate alert-router invocations for same alert_id
- **On-chain receipt error isolation** — already handled (non-blocking catch), but add structured error logging

### 4. Harden Canary Ingest

- **IP-based rate limiting** — currently only per-node rate limiting; add IP-based fallback
- **Payload size limit** — reject oversized `raw_result` payloads (>10KB)
- **Audit log enrichment** — include IP address in audit entries

## Technical Details

### Step 1: Fix Cron Auth (Database + Secret Changes)

SQL to execute:
```sql
-- Remove old cron job
SELECT cron.unschedule('aegis-detection-engine');

-- Remove old vault secret
DELETE FROM vault.secrets WHERE name = 'AEGIS_CRON_SECRET';

-- Insert new vault secret with known value
SELECT vault.create_secret('aegis-cron-2026-hardened-key', 'AEGIS_CRON_SECRET');
```

Then update edge function secret `AEGIS_CRON_SECRET` to `aegis-cron-2026-hardened-key`.

Then recreate cron job with vault lookup.

### Step 2: Detection Engine Code Changes

Update `supabase/functions/detection-engine/index.ts`:
- Add `console.log` on auth failure
- Add `console.log` on successful run start/end with signal counts
- Add per-ingestor error logging in the `Promise.allSettled` results
- Add 50s timeout guard

### Step 3: Alert Router Code Changes

Update `supabase/functions/alert-router/index.ts`:
- Validate UUID format on `alert_id`
- Add structured logging for delivery results

### Step 4: Canary Ingest Code Changes

Update `supabase/functions/canary-ingest/index.ts`:
- Add `raw_result` size check (reject > 10KB)
- Log IP in audit entries

