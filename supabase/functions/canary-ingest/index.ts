// ============================================================
// AEGIS — CANARY INGEST (Supabase Edge Function)
// Receives probe reports from canary nodes
// Validates API key + signature, updates reputation, builds consensus
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CanaryReport {
  node_id: string;
  protocol_slug: string;
  probe_name: string;
  success: boolean;
  latency_ms?: number;
  error_code?: string;
  error_message?: string;
  raw_result?: Record<string, unknown>;
  timestamp: number;
  signature: string;
  version: string;
  api_key?: string; // Required for browser probes
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(report: CanaryReport, walletAddress: string): Promise<boolean> {
  try {
    const message = [report.node_id, report.protocol_slug, report.probe_name, report.success.toString(), report.timestamp.toString()].join(":");
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = hexToBytes(report.signature);
    const pubKeyBytes = base58Decode(walletAddress);
    const pubKey = await crypto.subtle.importKey("raw", pubKeyBytes as ArrayBuffer, { name: "Ed25519" } as any, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519" as any, pubKey, sigBytes as ArrayBuffer, msgBytes as ArrayBuffer);
  } catch { return false; }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const ALPHABET_MAP = new Map(ALPHABET.split("").map((c, i) => [c, BigInt(i)]));
  let num = BigInt(0);
  for (const char of str) {
    const val = ALPHABET_MAP.get(char);
    if (val === undefined) throw new Error(`Invalid base58 char: ${char}`);
    num = num * BigInt(58) + val;
  }
  const hex = num.toString(16).padStart(64, "0");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function computeReputationDelta(reportedFailure: boolean, consensusFailure: boolean, consensusStrength: number): number {
  const agrees = reportedFailure === consensusFailure;
  return agrees ? 0.5 * consensusStrength : -2.0 * consensusStrength;
}

async function buildConsensus(
  supabase: ReturnType<typeof createClient>, protocolId: string, probeName: string, windowStart: Date, windowEnd: Date
) {
  const { data: reports } = await supabase.from("canary_reports")
    .select("success, latency_ms, canary_id").eq("protocol_id", protocolId).eq("probe_name", probeName)
    .gte("reported_at", windowStart.toISOString()).lte("reported_at", windowEnd.toISOString());
  if (!reports || reports.length === 0) return { total: 0, failures: 0, failureRate: 0, avgLatency: null, consensusReached: false };
  const uniqueCanaries = new Map<string, typeof reports[0]>();
  for (const r of reports) uniqueCanaries.set(r.canary_id, r);
  const deduped = Array.from(uniqueCanaries.values());
  const total = deduped.length;
  const failures = deduped.filter((r) => !r.success).length;
  const latencies = deduped.filter((r) => r.latency_ms != null).map((r) => r.latency_ms!);
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
  // Require minimum 5 unique canaries for P1/P2 alert consensus
  return { total, failures, failureRate: total > 0 ? failures / total : 0, avgLatency, consensusReached: total >= 5 };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let report: CanaryReport;
  try { report = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  for (const field of ["node_id", "protocol_slug", "probe_name", "timestamp", "signature", "version"]) {
    if (!(field in report)) return new Response(JSON.stringify({ error: `Missing field: ${field}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const ageSec = nowSec - report.timestamp;
  if (ageSec > 300 || ageSec < -30) return new Response(JSON.stringify({ error: "Report timestamp out of range" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: canary } = await supabase.from("canary_nodes")
    .select("id, wallet_address, reputation_score, status, total_reports, accurate_reports, false_reports, api_key_hash")
    .eq("node_id", report.node_id).maybeSingle();
  if (!canary) return new Response(JSON.stringify({ error: "Canary node not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (["BANNED", "SUSPENDED"].includes(canary.status)) return new Response(JSON.stringify({ error: `Canary node is ${canary.status.toLowerCase()}` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const isLowReputation = canary.reputation_score < 20;
  const isBrowserProbe = report.signature.startsWith("browser-");

  // ── AUTHENTICATION ──────────────────────────────────────────
  if (isBrowserProbe) {
    // Browser probes MUST supply a valid API key
    if (!report.api_key) {
      return new Response(JSON.stringify({ error: "API key required for browser probes" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const submittedHash = await hashKey(report.api_key);
    if (submittedHash !== canary.api_key_hash) {
      await supabase.from("canary_nodes").update({ reputation_score: Math.max(0, canary.reputation_score - 5), last_seen_at: new Date().toISOString() }).eq("id", canary.id);
      await supabase.from("aegis_audit_log").insert({ actor_id: canary.id, actor_type: "canary", action: "invalid_api_key", new_values: { node_id: report.node_id } });
      return new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } else {
    // CLI probes use Ed25519 signature verification
    const sigValid = await verifySignature(report, canary.wallet_address);
    if (!sigValid) {
      await supabase.from("canary_nodes").update({ reputation_score: Math.max(0, canary.reputation_score - 10), last_seen_at: new Date().toISOString() }).eq("id", canary.id);
      await supabase.from("aegis_audit_log").insert({ actor_id: canary.id, actor_type: "canary", action: "invalid_signature", new_values: { node_id: report.node_id, protocol_slug: report.protocol_slug } });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── PENDING NODE: auto-activate on first valid probe ────────
  if (canary.status === "PENDING") {
    await supabase.from("canary_nodes").update({ status: "ACTIVE" }).eq("id", canary.id);
    await supabase.from("aegis_audit_log").insert({ actor_id: canary.id, actor_type: "system", action: "canary_auto_activated", new_values: { node_id: report.node_id } });
  }

  // ── RATE LIMITING: max 1 probe per protocol per 2 minutes ──
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentProbes } = await supabase.from("canary_reports")
    .select("id").eq("canary_id", canary.id).eq("probe_name", report.probe_name)
    .gte("reported_at", twoMinAgo).limit(1);
  if (recentProbes && recentProbes.length > 0) {
    return new Response(JSON.stringify({ error: "Rate limited: max 1 probe per protocol per 2 minutes" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: protocol } = await supabase.from("protocols").select("id, name, slug").eq("slug", report.protocol_slug).eq("is_active", true).maybeSingle();
  if (!protocol) return new Response(JSON.stringify({ error: `Unknown protocol: ${report.protocol_slug}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  await supabase.from("canary_reports").insert({
    canary_id: canary.id, protocol_id: protocol.id, probe_name: report.probe_name,
    success: report.success, latency_ms: report.latency_ms ?? null,
    error_code: report.error_code ?? null, error_message: report.error_message ?? null,
    raw_result: report.raw_result ?? {}, signature: report.signature, reported_at: new Date().toISOString(),
  });

  await supabase.from("canary_nodes").update({ last_seen_at: new Date().toISOString(), total_reports: canary.total_reports + 1, version: report.version }).eq("id", canary.id);

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 5 * 60 * 1000);
  const consensus = await buildConsensus(supabase, protocol.id, report.probe_name, windowStart, windowEnd);

  if (consensus.total > 0) {
    await supabase.from("canary_consensus").insert({
      protocol_id: protocol.id, probe_name: report.probe_name,
      window_start: windowStart.toISOString(), window_end: windowEnd.toISOString(),
      total_reports: consensus.total, failure_count: consensus.failures, failure_rate: consensus.failureRate,
      avg_latency_ms: consensus.avgLatency, consensus_reached: consensus.consensusReached, alert_triggered: false,
    });
  }

  let alertTriggered = false;
  if (!isLowReputation && consensus.consensusReached && consensus.failureRate >= 0.6) {
    const { data: recentAlert } = await supabase.from("alert_dedup").select("dedup_key")
      .eq("dedup_key", `canary:${protocol.id}:${report.probe_name}`).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!recentAlert) {
      alertTriggered = true;
      await supabase.from("signals").insert({
        protocol_id: protocol.id, signal_type: "CANARY_PROBE_FAILURE", value: consensus.failureRate,
        metadata: { probe_name: report.probe_name, total_canaries: consensus.total, failures: consensus.failures, avg_latency_ms: consensus.avgLatency },
        source: "canary_consensus", recorded_at: new Date().toISOString(),
      });
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const failPct = (consensus.failureRate * 100).toFixed(0);
      fetch(`${supabaseUrl}/functions/v1/alert-router`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ alert_id: crypto.randomUUID(), protocol_id: protocol.id, severity: consensus.failureRate >= 0.8 ? "P1" : "P2", title: `CANARY CONSENSUS — ${protocol.name} probe failing`, description: `${failPct}% of canary nodes (${consensus.failures}/${consensus.total}) reporting ${report.probe_name} probe failure for ${protocol.name}.` }),
      }).catch((e) => console.error("Alert router error:", e));
      await supabase.from("alert_dedup").upsert({ dedup_key: `canary:${protocol.id}:${report.probe_name}`, alert_id: crypto.randomUUID(), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
      await supabase.from("canary_consensus").update({ alert_triggered: true }).eq("protocol_id", protocol.id).eq("probe_name", report.probe_name).gte("window_start", windowStart.toISOString());
    }
  }

  if (consensus.consensusReached && !isLowReputation) {
    const consensusIsFailure = consensus.failureRate >= 0.5;
    const delta = computeReputationDelta(!report.success, consensusIsFailure, Math.min(consensus.total / 10, 1));
    if (Math.abs(delta) > 0.01) {
      const newScore = Math.max(0, Math.min(100, canary.reputation_score + delta));
      await supabase.from("canary_nodes").update({ reputation_score: newScore, accurate_reports: delta > 0 ? canary.accurate_reports + 1 : canary.accurate_reports, false_reports: delta < 0 ? canary.false_reports + 1 : canary.false_reports }).eq("id", canary.id);
      if (newScore < 10) {
        await supabase.from("canary_nodes").update({ status: "SUSPENDED", banned_reason: `Auto-suspended: reputation dropped to ${newScore.toFixed(1)}` }).eq("id", canary.id);
      }
    }
  }

  await supabase.from("aegis_system_health").update({
    status: "healthy", last_success_at: new Date().toISOString(),
    metrics: { last_report_from: report.node_id, last_protocol: protocol.slug, consensus_size: consensus.total, alert_triggered: alertTriggered },
    updated_at: new Date().toISOString(),
  }).eq("component", "canary");

  return new Response(JSON.stringify({
    accepted: true, consensus: { total_reports: consensus.total, failure_rate: consensus.failureRate, consensus_reached: consensus.consensusReached, alert_triggered: alertTriggered },
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
