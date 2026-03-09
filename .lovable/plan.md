

# Set Telegram Bot Token and Proceed

## What will be done

1. **Store the Telegram bot token** as a backend secret (`TELEGRAM_BOT_TOKEN`) so the alert-router can deliver alerts via Telegram
2. **Skip Resend/email** — no `RESEND_API_KEY` needed for now; email channel will gracefully skip with an error log if triggered
3. **No code changes needed** — the alert-router already handles the case where `RESEND_API_KEY` is not set (returns `{ success: false, error: "RESEND_API_KEY not set" }`)

The alert-router is already deployed and fully supports Telegram delivery. Once the secret is stored, any alert fired by the detection engine will fan out to Telegram subscribers automatically.

