// ============================================================
// AEGIS — CANARY INGEST (Supabase Edge Function)
// Receives probe reports from canary nodes
// Validates signature, updates reputation, builds consensus
// Triggers alerts when consensus threshold is met
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CanaryReport {
  node_id: string;
  protocol_slug: string;
  probe_name: string;
  success: boolean;
  latency_ms?: number;
  error_code?: string;
  error_message?: string;
  raw_result?: Record<string, unknown>;
  timestamp: number;        // Unix timestamp (seconds)
  signature: string;        // Ed25519 signature of payload
  version: string;
}

// ─── Signature verification ───────────────────────────────────
// Canary signs: node_id + protocol_slug + probe_name + success + timestamp
// using their registered Solana wallet (Ed25519)
async function verifySignature(
  report: CanaryReport,
  walletAddress: string
): Promise<boolean> {
  try {
    // Build the exact message the canary should have signed
    const message = [
      report.node_id,
      report.protocol_slug,
      report.probe_name,
      report.success.toString(),
      report.timestamp.toString(),
    ].join(":");

    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = hexToBytes(report.signature);

    // Decode Solana base58 wallet address to Ed25519 public key
    const pubKeyBytes = base58Decode(walletAddress);

    // Verify using Web Crypto API
    const pubKey = await crypto.subtle.importKey(
      "raw", pubKeyBytes, { name: "Ed25519" }, false, ["verify"]
    );
    return await crypto.subtle.verify("Ed25519", pubKey, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Base58 decoder for Solana addresses
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
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ─── Reputation scoring ───────────────────────────────────────
// Consensus-validated: if canary report agrees with consensus → +0.5
// Report is outlier: if canary diverges from consensus → -2.0
// Max: 100, Min: 0. Below 20 = auto-suspend
function computeReputationDelta(
  reportedFailure: boolean,
  consensusFailure: boolean,
  consensusStrength: number  // 0-1 confidence in consensus
): number {
  const agrees = reportedFailure === consensusFailure;
  if (agrees) return 0.5 * consensusStrength;
  return -2.0 * consensusStrength;
}

// ─── Build consensus window ───────────────────────────────────
async function buildConsensus(
  supabase: ReturnType<typeof createClient>,
  protocolId: string,
  probeName: string,
  windowStart: Date,
  windowEnd: Date
): Promise<{
  total: number; failures: number; failureRate: number;
  avgLatency: number | null; consensusReached: boolean;
}> {
  const { data: reports } = await supabase
    .from("canary_reports")
    .select("success, latency_ms, canary_id")
    .eq("protocol_id", protocolId)
    .eq("probe_name", probeName)
    .gte("reported_at", windowStart.toISOString())
    .lte("reported_at", windowEnd.toISOString());

  if (!reports || reports.length === 0) {
    return { total: 0, failures: 0, failureRate: 0, avgLatency: null, consensusReached: false };
  }

  // Deduplicate: one report per canary per window
  const uniqueCanaries = new Map<string, typeof reports[0]>();
  for (const r of reports) {
    uniqueCanaries.set(r.canary_id, r);
  }
  const deduped = Array.from(uniqueCanaries.values());

  const total    = deduped.length;
  const failures = deduped.filter((r) => !r.success).length;
  const latencies = deduped.filter((r) => r.latency_ms != null).map((r) => r.latency_ms!);
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

  // Consensus requires ≥3 unique canaries agreeing
  const consensusReached = total >= 3;
  const failureRate = total > 0 ? failures / total : 0;

  return { total, failures, failureRate, avgLatency, consensusReached };
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req: Request): Promise<Response> => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let report: CanaryReport;
  try {
    report = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // ── Input validation ──────────────────────────────────────
  const requiredFields = ["node_id", "protocol_slug", "probe_name", "timestamp", "signature", "version"];
  for (const field of requiredFields) {
    if (!(field in report)) {
      return new Response(JSON.stringify({ error: `Missing field: ${field}` }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Timestamp freshness check (reject stale reports > 5 minutes old)
  const nowSec   = Math.floor(Date.now() / 1000);
  const ageSec   = nowSec - report.timestamp;
  if (ageSec > 300 || ageSec < -30) {
    return new Response(JSON.stringify({ error: "Report timestamp out of acceptable range" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // ── Look up canary node ───────────────────────────────────
  const { data: canary, error: canaryErr } = await supabase
    .from("canary_nodes")
    .select("id, wallet_address, reputation_score, status, total_reports, accurate_reports, false_reports")
    .eq("node_id", report.node_id)
    .maybeSingle();

  if (canaryErr || !canary) {
    return new Response(JSON.stringify({ error: "Canary node not found or not registered" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  if (canary.status === "BANNED") {
    return new Response(JSON.stringify({ error: "Canary node is banned" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  if (canary.status === "SUSPENDED") {
    return new Response(JSON.stringify({ error: "Canary node is suspended" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  if (canary.status === "PENDING") {
    return new Response(JSON.stringify({ error: "Canary node pending approval" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  // Low reputation: shadow-accept but don't count toward consensus
  const isLowReputation = canary.reputation_score < 20;
  if (isLowReputation) {
    console.warn(`Low reputation canary ${report.node_id} (score: ${canary.reputation_score}) — shadow mode`);
  }

  // ── Signature verification ────────────────────────────────
  const sigValid = await verifySignature(report, canary.wallet_address);
  if (!sigValid) {
    // Penalize reputation for invalid signature
    await supabase.from("canary_nodes").update({
      reputation_score: Math.max(0, canary.reputation_score - 10),
      last_seen_at: new Date().toISOString(),
    }).eq("id", canary.id);

    await supabase.from("audit_log").insert({
      actor_id: canary.id, actor_type: "canary",
      action: "invalid_signature",
      new_values: { node_id: report.node_id, protocol_slug: report.protocol_slug },
    });

    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  // ── Look up protocol ──────────────────────────────────────
  const { data: protocol } = await supabase
    .from("protocols")
    .select("id, name, slug")
    .eq("slug", report.protocol_slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!protocol) {
    return new Response(JSON.stringify({ error: `Unknown protocol: ${report.protocol_slug}` }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // ── Store canary report ───────────────────────────────────
  const { error: insertErr } = await supabase.from("canary_reports").insert({
    canary_id: canary.id,
    protocol_id: protocol.id,
    probe_name: report.probe_name,
    success: report.success,
    latency_ms: report.latency_ms ?? null,
    error_code: report.error_code ?? null,
    error_message: report.error_message ?? null,
    raw_result: report.raw_result ?? {},
    signature: report.signature,
    reported_at: new Date().toISOString(),
  });

  if (insertErr) {
    console.error("Failed to insert canary report:", insertErr);
    return new Response(JSON.stringify({ error: "Failed to store report" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  // ── Update canary last_seen ───────────────────────────────
  await supabase.from("canary_nodes").update({
    last_seen_at: new Date().toISOString(),
    total_reports: canary.total_reports + 1,
    version: report.version,
  }).eq("id", canary.id);

  // ── Build consensus (last 5 minutes, this probe + protocol) ──
  const windowEnd   = new Date();
  const windowStart = new Date(windowEnd.getTime() - 5 * 60 * 1000);

  const consensus = await buildConsensus(
    supabase, protocol.id, report.probe_name, windowStart, windowEnd
  );

  // ── Upsert consensus record ───────────────────────────────
  if (consensus.total > 0) {
    await supabase.from("canary_consensus").insert({
      protocol_id: protocol.id,
      probe_name: report.probe_name,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      total_reports: consensus.total,
      failure_count: consensus.failures,
      failure_rate: consensus.failureRate,
      avg_latency_ms: consensus.avgLatency,
      consensus_reached: consensus.consensusReached,
      alert_triggered: false,
    });
  }

  // ── Trigger alert if consensus reached and failure rate high ─
  const FAILURE_THRESHOLD = 0.6; // 60% of canaries reporting failure
  let alertTriggered = false;

  if (
    !isLowReputation &&
    consensus.consensusReached &&
    consensus.failureRate >= FAILURE_THRESHOLD
  ) {
    // Check if we already alerted for this probe recently
    const { data: recentAlert } = await supabase
      .from("alert_dedup")
      .select("dedup_key")
      .eq("dedup_key", `canary:${protocol.id}:${report.probe_name}`)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!recentAlert) {
      alertTriggered = true;

      // Inject canary signal into signals table
      await supabase.from("signals").insert({
        protocol_id: protocol.id,
        signal_type: "CANARY_PROBE_FAILURE",
        value: consensus.failureRate,
        metadata: {
          probe_name: report.probe_name,
          total_canaries: consensus.total,
          failures: consensus.failures,
          avg_latency_ms: consensus.avgLatency,
        },
        source: "canary_consensus",
        recorded_at: new Date().toISOString(),
      });

      // Fire alert via detection engine path
      const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

      const failPct = (consensus.failureRate * 100).toFixed(0);
      await fetch(`${supabaseUrl}/functions/v1/alert-router`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          alert_id: crypto.randomUUID(),
          protocol_id: protocol.id,
          severity: consensus.failureRate >= 0.8 ? "P1" : "P2",
          title: `CANARY CONSENSUS — ${protocol.name} probe failing`,
          description: `${failPct}% of canary nodes (${consensus.failures}/${consensus.total}) reporting ${report.probe_name} probe failure for ${protocol.name}. Avg latency: ${consensus.avgLatency?.toFixed(0) ?? "N/A"}ms.`,
        }),
      }).catch((e) => console.error("Alert router error:", e));

      // Register dedup (10 min cooldown for canary alerts)
      await supabase.from("alert_dedup").upsert({
        dedup_key: `canary:${protocol.id}:${report.probe_name}`,
        alert_id: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      // Update consensus record
      await supabase.from("canary_consensus")
        .update({ alert_triggered: true })
        .eq("protocol_id", protocol.id)
        .eq("probe_name", report.probe_name)
        .gte("window_start", windowStart.toISOString());
    }
  }

  // ── Reputation update based on consensus agreement ────────
  if (consensus.consensusReached && !isLowReputation) {
    const consensusIsFailure = consensus.failureRate >= 0.5;
    const delta = computeReputationDelta(
      !report.success,       // this canary said it failed
      consensusIsFailure,    // consensus says it failed
      Math.min(consensus.total / 10, 1) // confidence 0-1
    );

    if (Math.abs(delta) > 0.01) {
      const newScore = Math.max(0, Math.min(100, canary.reputation_score + delta));
      const accurate = delta > 0 ? canary.accurate_reports + 1 : canary.accurate_reports;
      const falseRep = delta < 0 ? canary.false_reports + 1 : canary.false_reports;
      await supabase.from("canary_nodes").update({
        reputation_score: newScore,
        accurate_reports: accurate,
        false_reports: falseRep,
      }).eq("id", canary.id);

      // Auto-suspend extremely low reputation canaries
      if (newScore < 10) {
        await supabase.from("canary_nodes").update({
          status: "SUSPENDED",
          banned_reason: `Auto-suspended: reputation dropped to ${newScore.toFixed(1)}`,
        }).eq("id", canary.id);
        console.warn(`Canary ${report.node_id} auto-suspended. Score: ${newScore.toFixed(1)}`);
      }
    }
  }

  // ── Update system health ──────────────────────────────────
  await supabase.from("system_health").update({
    status: "healthy",
    last_success_at: new Date().toISOString(),
    metrics: {
      last_report_from: report.node_id,
      last_protocol: protocol.slug,
      consensus_size: consensus.total,
      alert_triggered: alertTriggered,
    },
    updated_at: new Date().toISOString(),
  }).eq("component", "canary");

  return new Response(JSON.stringify({
    accepted: true,
    consensus: {
      total_reports: consensus.total,
      failure_rate: consensus.failureRate,
      consensus_reached: consensus.consensusReached,
      alert_triggered: alertTriggered,
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
