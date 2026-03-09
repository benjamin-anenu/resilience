// ============================================================
// AEGIS — ALERT ROUTER (Supabase Edge Function)
// Receives a fired alert and fans out to all subscriber channels
// Handles: Telegram, Discord, Email (Resend), Webhooks, Push
// Built-in: dedup, rate limiting, retry logic, audit trail
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────
interface AlertPayload {
  alert_id: string;
  protocol_id: string;
  severity: "P1" | "P2" | "P3" | "INFO";
  title: string;
  description: string;
}

interface Subscriber {
  subscriber_id: string;
  channel: string;
  destination: string;
  config: Record<string, unknown>;
}

// ─── Severity emoji + color mapping ──────────────────────────
const SEVERITY_META = {
  P1:   { emoji: "🔴", label: "CRITICAL",   color: 16711680  },
  P2:   { emoji: "🟠", label: "WARNING",    color: 16744272  },
  P3:   { emoji: "🟡", label: "WATCH",      color: 16776960  },
  INFO: { emoji: "ℹ️",  label: "INFO",       color: 3447003   },
} as const;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(url: string, options: RequestInit, retries = 3): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      // Respect Telegram/Discord rate limits
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "2") * 1000;
        await delay(retryAfter);
        continue;
      }
      if (res.status >= 500 && i < retries) { await delay(1000 * (i + 1)); continue; }
      return res; // return non-ok for caller to inspect
    } catch {
      clearTimeout(timer);
      if (i < retries) await delay(500 * (i + 1));
    }
  }
  return null;
}

// ============================================================
// NOTIFICATION SENDERS
// ============================================================

// --- Telegram ---
async function sendTelegram(
  chatId: string,
  token: string,
  alert: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;
  const text = [
    `${meta.emoji} <b>AEGIS ${meta.label}</b>`,
    ``,
    `<b>${escapeHtml(alert.title)}</b>`,
    ``,
    escapeHtml(alert.description),
    ``,
    `<i>🛡️ Aegis Early Warning System</i>`,
  ].join("\n");

  const res = await safeFetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    }
  );

  if (!res) return { success: false, error: "No response from Telegram API" };
  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `Telegram ${res.status}: ${body}` };
  }
  return { success: true };
}

// --- Discord ---
async function sendDiscord(
  webhookUrl: string,
  alert: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;

  const payload = {
    username: "Aegis Warning System",
    avatar_url: "https://aegis.build/avatar.png",
    embeds: [{
      title: `${meta.emoji} ${alert.title}`,
      description: alert.description,
      color: meta.color,
      footer: { text: "🛡️ Aegis — Solana Supply Chain Protection" },
      timestamp: new Date().toISOString(),
      fields: [
        { name: "Severity", value: `${meta.emoji} ${meta.label}`, inline: true },
        { name: "Alert ID", value: alert.alert_id.slice(0, 8) + "...", inline: true },
      ],
    }],
  };

  const res = await safeFetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res) return { success: false, error: "No response from Discord" };
  if (!res.ok) return { success: false, error: `Discord ${res.status}` };
  return { success: true };
}

// --- Email via Resend (free tier: 3000/month) ---
async function sendEmail(
  toEmail: string,
  resendApiKey: string,
  alert: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;">
  <div style="border-left:4px solid ${meta.color === 16711680 ? '#ff0000' : meta.color === 16744272 ? '#ff8800' : '#ffff00'};padding:16px;margin-bottom:20px;">
    <h2 style="margin:0;color:#fff;">${meta.emoji} ${escapeHtml(alert.title)}</h2>
  </div>
  <p style="color:#aaa;">${escapeHtml(alert.description)}</p>
  <hr style="border-color:#333;"/>
  <p style="font-size:12px;color:#666;">Alert ID: ${alert.alert_id} — 🛡️ Aegis Early Warning System</p>
</body>
</html>`;

  const res = await safeFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Aegis <alerts@aegis.build>",
      to: [toEmail],
      subject: `${meta.emoji} AEGIS ${meta.label}: ${alert.title}`,
      html,
    }),
  });

  if (!res) return { success: false, error: "No response from Resend" };
  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `Resend ${res.status}: ${body}` };
  }
  return { success: true };
}

// --- Webhook (developer POST endpoint) ---
async function sendWebhook(
  webhookUrl: string,
  secret: string | undefined,
  alert: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    aegis_version: "1.0",
    alert_id: alert.alert_id,
    protocol_id: alert.protocol_id,
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    fired_at: new Date().toISOString(),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Aegis-Alert-Id": alert.alert_id,
    "X-Aegis-Severity": alert.severity,
  };

  // HMAC signature for webhook verification
  if (secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(JSON.stringify(payload));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, msgData);
    headers["X-Aegis-Signature"] = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const res = await safeFetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res) return { success: false, error: "Webhook unreachable" };
  if (!res.ok) return { success: false, error: `Webhook ${res.status}` };
  return { success: true };
}

// --- ntfy.sh push notification (free, open source) ---
async function sendNtfy(
  topic: string,
  alert: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;
  const priority = alert.severity === "P1" ? "urgent"
    : alert.severity === "P2" ? "high"
    : alert.severity === "P3" ? "default" : "low";

  const res = await safeFetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Title": `${meta.emoji} ${alert.title}`,
      "Priority": priority,
      "Tags": `shield,${alert.severity.toLowerCase()}`,
    },
    body: alert.description,
  });

  if (!res) return { success: false, error: "ntfy.sh unreachable" };
  if (!res.ok) return { success: false, error: `ntfy ${res.status}` };
  return { success: true };
}

// ─── HTML escape helper ───────────────────────────────────────
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// RATE LIMITER (in-memory per invocation — sufficient at scale
// since Edge Functions are stateless and Upstash handles global)
// ============================================================
const sentThisRun = new Set<string>();

function checkLocalDedup(subscriberId: string, alertId: string): boolean {
  const key = `${subscriberId}:${alertId}`;
  if (sentThisRun.has(key)) return true;
  sentThisRun.add(key);
  return false;
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req: Request): Promise<Response> => {
  // Auth check
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const alert: AlertPayload = await req.json();
  if (!alert.alert_id || !alert.severity) {
    return new Response(JSON.stringify({ error: "Missing alert fields" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Load env secrets
  const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const resendApiKey     = Deno.env.get("RESEND_API_KEY");

  // Get all subscribers for this protocol + severity
  const { data: subscribers, error: subErr } = await supabase.rpc("get_alert_subscribers", {
    p_protocol_id: alert.protocol_id,
    p_severity: alert.severity,
  });

  if (subErr) {
    console.error("Failed to fetch subscribers:", subErr);
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  if (!subscribers || subscribers.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No subscribers" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // Fan out to all subscribers
  let sent = 0; let failed = 0; let deduped = 0;
  const notifLogs: Array<{
    alert_id: string; subscriber_id: string; channel: string;
    destination: string; status: string; error_message?: string;
  }> = [];

  // Process in batches of 20 to avoid overwhelming external APIs
  const BATCH_SIZE = 20;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch: Subscriber[] = subscribers.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (sub: Subscriber) => {
        if (checkLocalDedup(sub.subscriber_id, alert.alert_id)) {
          deduped++;
          return;
        }

        let result: { success: boolean; error?: string };

        try {
          switch (sub.channel) {
            case "TELEGRAM":
              if (!telegramBotToken) {
                result = { success: false, error: "TELEGRAM_BOT_TOKEN not set" };
              } else {
                result = await sendTelegram(sub.destination, telegramBotToken, alert);
              }
              break;
            case "DISCORD":
              result = await sendDiscord(sub.destination, alert);
              break;
            case "EMAIL":
              if (!resendApiKey) {
                result = { success: false, error: "RESEND_API_KEY not set" };
              } else {
                result = await sendEmail(sub.destination, resendApiKey, alert);
              }
              break;
            case "WEBHOOK":
              const webhookSecret = (sub.config as Record<string, string>)?.secret;
              result = await sendWebhook(sub.destination, webhookSecret, alert);
              break;
            case "PUSH":
              result = await sendNtfy(sub.destination, alert);
              break;
            default:
              result = { success: false, error: `Unknown channel: ${sub.channel}` };
          }
        } catch (e) {
          result = { success: false, error: e instanceof Error ? e.message : String(e) };
        }

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.warn(`Failed to send to ${sub.channel}:${sub.destination}:`, result.error);
        }

        notifLogs.push({
          alert_id: alert.alert_id,
          subscriber_id: sub.subscriber_id,
          channel: sub.channel,
          destination: sub.destination,
          status: result.success ? "sent" : "failed",
          error_message: result.error,
        });
      })
    );

    // Small pause between batches to respect rate limits
    if (i + BATCH_SIZE < subscribers.length) await delay(200);
  }

  // Write notification log in bulk
  if (notifLogs.length > 0) {
    await supabase.from("notification_log").insert(
      notifLogs.map((l) => ({ ...l, sent_at: new Date().toISOString() }))
    );
  }

  // Update system health
  await supabase.from("system_health").update({
    status: "healthy",
    last_success_at: new Date().toISOString(),
    metrics: { last_alert_id: alert.alert_id, sent, failed, deduped },
    updated_at: new Date().toISOString(),
  }).eq("component", "notification");

  return new Response(
    JSON.stringify({ sent, failed, deduped, total: subscribers.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
