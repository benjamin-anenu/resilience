// ============================================================
// AEGIS — ALERT ROUTER (Supabase Edge Function)
// Receives a fired alert and fans out to all subscriber channels
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const SEVERITY_META = {
  P1:   { emoji: "🔴", label: "CRITICAL",   color: 16711680  },
  P2:   { emoji: "🟠", label: "WARNING",    color: 16744272  },
  P3:   { emoji: "🟡", label: "WATCH",      color: 16776960  },
  INFO: { emoji: "ℹ️",  label: "INFO",       color: 3447003   },
} as const;

const delayMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(url: string, options: RequestInit, retries = 3): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "2") * 1000;
        await delayMs(retryAfter);
        continue;
      }
      if (res.status >= 500 && i < retries) { await delayMs(1000 * (i + 1)); continue; }
      return res;
    } catch {
      clearTimeout(timer);
      if (i < retries) await delayMs(500 * (i + 1));
    }
  }
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendTelegram(chatId: string, token: string, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;
  const text = `${meta.emoji} <b>AEGIS ${meta.label}</b>\n\n<b>${escapeHtml(alert.title)}</b>\n\n${escapeHtml(alert.description)}\n\n<i>🛡️ Aegis Early Warning System</i>`;
  const res = await safeFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res) return { success: false, error: "No response from Telegram API" };
  if (!res.ok) return { success: false, error: `Telegram ${res.status}` };
  return { success: true };
}

async function sendDiscord(webhookUrl: string, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;
  const res = await safeFetch(webhookUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Aegis Warning System",
      embeds: [{
        title: `${meta.emoji} ${alert.title}`, description: alert.description, color: meta.color,
        footer: { text: "🛡️ Aegis — Solana Supply Chain Protection" }, timestamp: new Date().toISOString(),
        fields: [
          { name: "Severity", value: `${meta.emoji} ${meta.label}`, inline: true },
          { name: "Alert ID", value: alert.alert_id.slice(0, 8) + "...", inline: true },
        ],
      }],
    }),
  });
  if (!res) return { success: false, error: "No response from Discord" };
  if (!res.ok) return { success: false, error: `Discord ${res.status}` };
  return { success: true };
}

async function sendEmail(toEmail: string, resendApiKey: string, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;
  const html = `<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;"><h2 style="color:#fff;">${meta.emoji} ${escapeHtml(alert.title)}</h2><p style="color:#aaa;">${escapeHtml(alert.description)}</p><hr style="border-color:#333;"/><p style="font-size:12px;color:#666;">Alert ID: ${alert.alert_id} — 🛡️ Aegis</p></div>`;
  const res = await safeFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify({ from: "Aegis <alerts@aegis.build>", to: [toEmail], subject: `${meta.emoji} AEGIS ${meta.label}: ${alert.title}`, html }),
  });
  if (!res) return { success: false, error: "No response from Resend" };
  if (!res.ok) return { success: false, error: `Resend ${res.status}` };
  return { success: true };
}

async function sendWebhook(webhookUrl: string, secret: string | undefined, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const payload = { aegis_version: "1.0", alert_id: alert.alert_id, protocol_id: alert.protocol_id, severity: alert.severity, title: alert.title, description: alert.description, fired_at: new Date().toISOString() };
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Aegis-Alert-Id": alert.alert_id, "X-Aegis-Severity": alert.severity };
  if (secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
    headers["X-Aegis-Signature"] = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const res = await safeFetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res) return { success: false, error: "Webhook unreachable" };
  if (!res.ok) return { success: false, error: `Webhook ${res.status}` };
  return { success: true };
}

async function sendNtfy(topic: string, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.INFO;
  const priority = alert.severity === "P1" ? "urgent" : alert.severity === "P2" ? "high" : "default";
  const res = await safeFetch(`https://ntfy.sh/${topic}`, {
    method: "POST", headers: { "Content-Type": "text/plain", "Title": `${meta.emoji} ${alert.title}`, "Priority": priority, "Tags": `shield,${alert.severity.toLowerCase()}` },
    body: alert.description,
  });
  if (!res) return { success: false, error: "ntfy.sh unreachable" };
  if (!res.ok) return { success: false, error: `ntfy ${res.status}` };
  return { success: true };
}

const sentThisRun = new Set<string>();
function checkLocalDedup(subscriberId: string, alertId: string): boolean {
  const key = `${subscriberId}:${alertId}`;
  if (sentThisRun.has(key)) return true;
  sentThisRun.add(key);
  return false;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const alert: AlertPayload = await req.json();
  if (!alert.alert_id || !alert.severity) {
    return new Response(JSON.stringify({ error: "Missing alert fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  const { data: subscribers, error: subErr } = await supabase.rpc("get_alert_subscribers", {
    p_protocol_id: alert.protocol_id, p_severity: alert.severity,
  });

  if (subErr) {
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!subscribers || subscribers.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No subscribers" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0; let failed = 0; let deduped = 0;
  const notifLogs: Array<{
    alert_id: string; subscriber_id: string; channel: string;
    destination: string; status: string; error_message?: string;
  }> = [];

  const BATCH_SIZE = 20;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch: Subscriber[] = subscribers.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (sub: Subscriber) => {
        if (checkLocalDedup(sub.subscriber_id, alert.alert_id)) { deduped++; return; }
        let result: { success: boolean; error?: string };
        try {
          switch (sub.channel) {
            case "TELEGRAM":
              result = !telegramBotToken ? { success: false, error: "TELEGRAM_BOT_TOKEN not set" } : await sendTelegram(sub.destination, telegramBotToken, alert);
              break;
            case "DISCORD": result = await sendDiscord(sub.destination, alert); break;
            case "EMAIL":
              result = !resendApiKey ? { success: false, error: "RESEND_API_KEY not set" } : await sendEmail(sub.destination, resendApiKey, alert);
              break;
            case "WEBHOOK": result = await sendWebhook(sub.destination, (sub.config as Record<string, string>)?.secret, alert); break;
            case "PUSH": result = await sendNtfy(sub.destination, alert); break;
            default: result = { success: false, error: `Unknown channel: ${sub.channel}` };
          }
        } catch (e) { result = { success: false, error: e instanceof Error ? e.message : String(e) }; }
        if (result.success) sent++; else failed++;
        notifLogs.push({ alert_id: alert.alert_id, subscriber_id: sub.subscriber_id, channel: sub.channel, destination: sub.destination, status: result.success ? "sent" : "failed", error_message: result.error });
      })
    );
    if (i + BATCH_SIZE < subscribers.length) await delayMs(200);
  }

  if (notifLogs.length > 0) {
    await supabase.from("aegis_notification_log").insert(notifLogs.map((l) => ({ ...l, sent_at: new Date().toISOString() })));
  }

  // On-Chain Receipt — write a Solana memo transaction as tamper-proof proof
  let onchainSignature: string | null = null;
  try {
    const rpcUrl = Deno.env.get("RPC_URL");
    if (rpcUrl && (alert.severity === "P1" || alert.severity === "P2")) {
      const memoData = JSON.stringify({
        aegis: "1.0",
        alert_id: alert.alert_id,
        severity: alert.severity,
        title: alert.title.slice(0, 64),
        ts: new Date().toISOString(),
      });

      // Use Solana Memo program to store alert receipt on-chain
      // We import @solana/web3.js for edge function usage
      const { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } = await import("https://esm.sh/@solana/web3.js@1.98.0");

      const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

      // The alert-router uses a service keypair stored as a secret
      const keypairSecret = Deno.env.get("AEGIS_ONCHAIN_KEYPAIR");
      if (keypairSecret) {
        const secretKey = Uint8Array.from(JSON.parse(keypairSecret));
        const payer = Keypair.fromSecretKey(secretKey);
        const connection = new Connection(rpcUrl, "confirmed");

        const tx = new Transaction().add(
          new TransactionInstruction({
            keys: [],
            programId: MEMO_PROGRAM_ID,
            data: new TextEncoder().encode(memoData),
          })
        );

        onchainSignature = await sendAndConfirmTransaction(connection, tx, [payer], {
          commitment: "confirmed",
          maxRetries: 2,
        });

        // Store the signature on the alert record
        await supabase.from("alerts").update({ onchain_signature: onchainSignature }).eq("id", alert.alert_id);
      }
    }
  } catch (e) {
    console.error("On-chain receipt failed (non-blocking):", e instanceof Error ? e.message : e);
  }

  await supabase.from("aegis_system_health").update({
    status: "healthy", last_success_at: new Date().toISOString(),
    metrics: { last_alert_id: alert.alert_id, sent, failed, deduped, onchain_signature: onchainSignature },
    updated_at: new Date().toISOString(),
  }).eq("component", "notification");

  return new Response(JSON.stringify({ sent, failed, deduped, total: subscribers.length, onchain_signature: onchainSignature }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
