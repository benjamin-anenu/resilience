

# Save VALIDATORS_APP_TOKEN + Clean Up Temp Function

## Steps

1. **Save VALIDATORS_APP_TOKEN** — I'll prompt you to paste your validators.app API key as a secret called `VALIDATORS_APP_TOKEN`. This is used by the detection engine's `ingestValidatorHealth()` function.

2. **Delete `generate-aegis-keypair` function** — Remove `supabase/functions/generate-aegis-keypair/index.ts` and its config entry from `supabase/config.toml`.

Both are quick, no code logic changes needed.

