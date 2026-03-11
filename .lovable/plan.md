

# Aegis Security Hardening — Implemented

## Status: ✅ COMPLETED

### Changes Made

#### 1. **canary-ingest** — API key validation + rate limiting
- Browser probes now **require a valid API key** — hashed with SHA-256 and compared against stored `api_key_hash`
- Invalid API keys penalize reputation (-5) and log to audit trail
- **Rate limiting**: max 1 probe per node per protocol per 2 minutes (429 response)
- **Consensus minimum raised** from 3 → 5 unique canaries required for alert-triggering consensus
- PENDING nodes auto-activate on first valid authenticated probe

#### 2. **CanaryProbeSubmission.tsx** — Browser UI fixes
- Added **success/failure toggle** (was hardcoded `success: true`)
- API key now **sent to edge function** for validation (was collected but never transmitted)
- Better error handling: shows edge function error messages in UI

#### 3. **register-canary-node** — Sybil prevention
- New nodes register as **PENDING** (was ACTIVE) — prevents instant sybil attacks
- Nodes activate only after submitting a valid authenticated probe

### Security improvements summary
| Vector | Before | After |
|--------|--------|-------|
| API key validation | Never checked | SHA-256 hash comparison |
| Browser probe auth | None (bypass) | API key required |
| Sybil registration | Auto-ACTIVE | PENDING → activate on valid probe |
| Rate limiting | None | 1 probe/protocol/2min per node |
| Consensus minimum | 3 nodes | 5 nodes |
| Probe result | Hardcoded true | User-toggleable |

### Remaining items (deferred)
- Wallet signature verification for subscription manager
- Missing secrets: `RESEND_API_KEY`, `AEGIS_ONCHAIN_KEYPAIR`
- RLS policy to hide `wallet_address` from public canary_nodes reads
