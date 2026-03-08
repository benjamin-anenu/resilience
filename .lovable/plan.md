

# Fix False "Down" Status in Ecosystem Status Monitor

## Problem
Jupiter (401), Birdeye (401), and Magic Eden (429) are marked "down" because the check only considers `res.ok` (HTTP 200-299). These services are alive and responding with low latency -- they just require API keys or are rate-limiting.

## Solution
Apply the same HTTP-first strategy used in the RPC Health Monitor.

### 1. Edge Function (`supabase/functions/check-ecosystem-status/index.ts`)
- Add a `requires_key` flag to service definitions for Jupiter and Birdeye
- Treat HTTP 401/403 from `requires_key` services as a new `"auth_required"` status instead of "down"
- Treat HTTP 429 as `"rate_limited"` (degraded) instead of "down" -- the service is clearly alive
- Only mark "down" for network failures, timeouts, or HTTP 5xx errors
- Keep latency data for all reachable services

Updated status logic:
```text
HTTP 200-299          → "up" (or "degraded" if latency > 2000ms)
HTTP 401/403 + key    → "auth_required"
HTTP 429              → "rate_limited"  
HTTP 5xx / timeout    → "down"
```

### 2. Frontend (`src/components/tools/EcosystemStatus.tsx`)
- Add status config entries for `auth_required` and `rate_limited`
- `auth_required`: Lock icon + "Requires Key" badge (same pattern as RPC monitor)
- `rate_limited`: Yellow/orange badge showing "Rate Limited" -- clearly not down
- Update the summary pills to account for the new statuses
- Show latency for all reachable services regardless of auth status

### Files Modified
- `supabase/functions/check-ecosystem-status/index.ts`
- `src/components/tools/EcosystemStatus.tsx`

