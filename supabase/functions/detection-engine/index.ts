// ============================================================
// AEGIS — DETECTION ENGINE (Supabase Edge Function)
// Triggered every 60s via external cron
// Ingests signals → Rule Engine → Correlation Engine → Alerts
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-aegis-cron-secret',
};

// ─── Types ───────────────────────────────────────────────────
interface Protocol {
  id: string; slug: string; name: string; category: string;
  program_address: string | null; defillama_slug: string | null;
  monitoring_config: Record<string, unknown>;
}
interface Signal {
  protocol_id: string; signal_type: string; value: number;
  baseline?: number; zscore?: number;
  metadata: Record<string, unknown>; source: string;
}
interface DetectionRule {
  id: string; name: string; description: string | null; signal_type: string;
  protocol_id: string | null; category: string | null;
  threshold_value: number | null; threshold_pct: number | null;
  window_seconds: number; min_occurrences: number;
  severity: string; cooldown_seconds: number;
}
interface CorrelationPattern {
  id: string; name: string; description: string; fire_count: number;
  signals_required: Array<{
    signal_type: string; threshold_pct?: number;
    threshold_ms?: number; threshold_factor?: number;
  }>;
  min_signals_match: number; severity: string; time_window_seconds: number;
}
interface SignalBaseline {
  mean_24h: number; stddev_24h: number;
  mean_1h: number; stddev_1h: number;
}

// ─── Constants ───────────────────────────────────────────────
const MAX_SIGNALS_PER_RUN = 500;
const DEFILLAMA_BASE      = "https://api.llama.fi";
const JUPITER_PRICE_BASE  = "https://price.jup.ag/v6";
const VALIDATORS_APP_BASE = "https://www.validators.app/api/v1";
const SOLANA_RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
];

let rpcIndex = 0;
const getNextRpc = () => SOLANA_RPC_ENDPOINTS[rpcIndex++ % SOLANA_RPC_ENDPOINTS.length];
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(
  url: string, options: RequestInit = {},
  timeoutMs = 8000, retries = 2
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.status === 429) { await delay(1000 * Math.pow(2, attempt)); continue; }
      return null;
    } catch { clearTimeout(timer); if (attempt < retries) await delay(500 * (attempt + 1)); }
  }
  return null;
}

async function solanaRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await safeFetch(getNextRpc(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res) return null;
  const json = await res.json();
  return json.result ?? null;
}

// ============================================================
// INGESTORS
// ============================================================

async function ingestDefiLlamaTvl(protocols: Protocol[]): Promise<Signal[]> {
  const signals: Signal[] = [];
  const res = await safeFetch(`${DEFILLAMA_BASE}/protocols`);
  if (!res) return signals;
  const allProtocols: Array<{ slug: string; tvl: number; change_1h: number; change_1d: number }> =
    await res.json();
  const llamaMap = new Map(allProtocols.map((p) => [p.slug, p]));
  for (const protocol of protocols) {
    if (!protocol.defillama_slug) continue;
    const data = llamaMap.get(protocol.defillama_slug);
    if (!data) continue;
    signals.push({
      protocol_id: protocol.id, signal_type: "TVL_DROP", value: data.tvl,
      metadata: { change_1h: data.change_1h, change_1d: data.change_1d }, source: "defillama",
    });
    if (typeof data.change_1h === "number") {
      signals.push({
        protocol_id: protocol.id, signal_type: "LIQUIDITY_DRAIN",
        value: Math.abs(Math.min(data.change_1h, 0)),
        metadata: { change_1h: data.change_1h }, source: "defillama",
      });
    }
  }
  return signals;
}

async function ingestJupiterPrices(protocols: Protocol[]): Promise<Signal[]> {
  const signals: Signal[] = [];
  const dexProtocols = protocols.filter((p) => p.category === "DEX");
  if (!dexProtocols.length) return signals;
  const res = await safeFetch(`${JUPITER_PRICE_BASE}/price?ids=SOL&vsToken=USDC`);
  if (!res) return signals;
  const data = await res.json();
  const solPrice = data.data?.SOL?.price;
  if (solPrice) {
    for (const protocol of dexProtocols) {
      signals.push({
        protocol_id: protocol.id, signal_type: "PRICE_IMPACT_INCREASE",
        value: solPrice, metadata: { vsToken: "USDC" }, source: "jupiter",
      });
    }
  }
  return signals;
}

async function ingestSolanaNetworkHealth(protocols: Protocol[]): Promise<Signal[]> {
  const signals: Signal[] = [];
  const perfSamples = await solanaRpc("getRecentPerformanceSamples", [5]) as Array<{
    numTransactions: number; numSlots: number; samplePeriodSecs: number;
  }> | null;
  if (!perfSamples || !Array.isArray(perfSamples) || !perfSamples[0]) return signals;
  const latest = perfSamples[0];
  const tps = latest.numTransactions / latest.samplePeriodSecs;
  const slotTimeMs = (latest.samplePeriodSecs / latest.numSlots) * 1000;
  const txFailureProxy = Math.max(0, 1 - tps / 2000);
  const infraProtocols = protocols.filter((p) =>
    ["RPC", "VALIDATOR", "INFRASTRUCTURE"].includes(p.category)
  );
  for (const protocol of infraProtocols) {
    signals.push({
      protocol_id: protocol.id, signal_type: "SLOT_LAG", value: slotTimeMs,
      metadata: { tps, samplePeriodSecs: latest.samplePeriodSecs }, source: "solana_rpc",
    });
    signals.push({
      protocol_id: protocol.id, signal_type: "TX_FAILURE_SPIKE", value: txFailureProxy,
      metadata: { tps, normal_tps: 2000 }, source: "solana_rpc",
    });
  }
  return signals;
}

async function ingestPythOracles(protocols: Protocol[]): Promise<Signal[]> {
  const signals: Signal[] = [];
  const oracleProtocols = protocols.filter((p) => p.category === "ORACLE");
  const pythFeeds = [
    { id: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", symbol: "SOL/USD" },
    { id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", symbol: "BTC/USD" },
  ];
  for (const feed of pythFeeds) {
    const res = await safeFetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feed.id}`
    );
    if (!res) continue;
    const data = await res.json();
    const priceUpdate = data?.parsed?.[0];
    if (!priceUpdate) continue;
    const stalenessSeconds = Math.floor(Date.now() / 1000) - priceUpdate.price?.publish_time;
    const price = (priceUpdate.price?.price || 0) * Math.pow(10, priceUpdate.price?.expo ?? 0);
    const confidence = priceUpdate.price?.conf || 0;
    for (const protocol of oracleProtocols) {
      signals.push({
        protocol_id: protocol.id, signal_type: "ORACLE_STALENESS", value: stalenessSeconds,
        metadata: { feed: feed.symbol, price }, source: "pyth_hermes",
      });
      if (price > 0) {
        signals.push({
          protocol_id: protocol.id, signal_type: "ORACLE_DEVIATION",
          value: confidence / Math.abs(price),
          metadata: { feed: feed.symbol, confidence, price }, source: "pyth_hermes",
        });
      }
    }
  }
  return signals;
}

async function ingestValidatorHealth(
  protocols: Protocol[], token: string | undefined
): Promise<Signal[]> {
  const signals: Signal[] = [];
  const valProtocols = protocols.filter((p) => p.category === "VALIDATOR");
  if (!valProtocols.length) return signals;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Token"] = token;
  const res = await safeFetch(
    `${VALIDATORS_APP_BASE}/validators/mainnet.json?limit=50&order=skip_rate`, { headers }
  );
  if (!res) return signals;
  const validators: Array<{ skip_rate: number; stake_weight: number; delinquent: boolean }> =
    await res.json();
  if (!Array.isArray(validators)) return signals;
  const totalStake = validators.reduce((s, v) => s + (v.stake_weight || 0), 0);
  const weightedSkipRate = validators.reduce(
    (s, v) => s + (v.skip_rate || 0) * ((v.stake_weight || 0) / (totalStake || 1)), 0
  );
  const delinquentRatio = totalStake > 0
    ? validators.filter((v) => v.delinquent).reduce((s, v) => s + (v.stake_weight || 0), 0) / totalStake
    : 0;
  for (const protocol of valProtocols) {
    signals.push({
      protocol_id: protocol.id, signal_type: "VALIDATOR_SKIP_RATE", value: weightedSkipRate,
      metadata: { sample_size: validators.length, delinquent_ratio: delinquentRatio },
      source: "validators_app",
    });
    signals.push({
      protocol_id: protocol.id, signal_type: "STAKE_SHIFT", value: delinquentRatio,
      metadata: { delinquent_stake_pct: delinquentRatio }, source: "validators_app",
    });
  }
  return signals;
}

async function ingestBridgeHealth(protocols: Protocol[]): Promise<Signal[]> {
  const signals: Signal[] = [];
  const bridgeProtocols = protocols.filter((p) => p.category === "BRIDGE");
  if (!bridgeProtocols.length) return signals;
  const res = await safeFetch(`${DEFILLAMA_BASE}/bridges?includeChains=true`);
  if (!res) return signals;
  const data: { bridges: Array<{ displayName: string; volumePrevDay: number; volumePrev2Day: number }> } =
    await res.json();
  for (const protocol of bridgeProtocols) {
    const bridge = data.bridges?.find((b) =>
      b.displayName.toLowerCase().includes(protocol.slug.toLowerCase())
    );
    if (!bridge) continue;
    const volumeChange = bridge.volumePrev2Day > 0
      ? (bridge.volumePrevDay - bridge.volumePrev2Day) / bridge.volumePrev2Day : 0;
    signals.push({
      protocol_id: protocol.id, signal_type: "BRIDGE_IMBALANCE",
      value: Math.abs(Math.min(volumeChange, 0)),
      metadata: {
        volume_prev_day: bridge.volumePrevDay,
        volume_prev_2day: bridge.volumePrev2Day,
        change_pct: volumeChange,
      },
      source: "defillama_bridges",
    });
  }
  return signals;
}

// ============================================================
// RULE ENGINE
// ============================================================
async function runRuleEngine(
  supabase: ReturnType<typeof createClient>,
  signals: Signal[],
  rules: DetectionRule[],
  baselines: Map<string, SignalBaseline>
): Promise<Array<{ rule: DetectionRule; protocol_id: string; matched_signal: Signal; zscore: number | null }>> {
  const matches = [];
  for (const signal of signals) {
    const applicableRules = rules.filter(
      (r) => r.signal_type === signal.signal_type &&
        (r.protocol_id === null || r.protocol_id === signal.protocol_id)
    );
    for (const rule of applicableRules) {
      const { data: deduped } = await supabase.rpc("is_alert_deduped", {
        p_rule_id: rule.id, p_protocol_id: signal.protocol_id,
      });
      if (deduped) continue;

      const baseline = baselines.get(`${signal.protocol_id}:${signal.signal_type}`);
      const zscore = baseline && baseline.stddev_24h > 0
        ? (signal.value - baseline.mean_24h) / baseline.stddev_24h : null;

      let triggered = false;
      if (rule.threshold_pct !== null) {
        triggered = signal.value >= rule.threshold_pct;
      } else if (rule.signal_type === "ORACLE_STALENESS") {
        triggered = signal.value >= rule.window_seconds;
      } else if (rule.signal_type === "SLOT_LAG") {
        triggered = signal.value >= 500;
      } else if (rule.signal_type === "RPC_LATENCY_SPIKE") {
        triggered = signal.value >= 5000;
      }
      if (!triggered && zscore !== null && Math.abs(zscore) > 3.5) triggered = true;
      if (triggered) matches.push({ rule, protocol_id: signal.protocol_id, matched_signal: signal, zscore });
    }
  }
  return matches;
}

// ============================================================
// CORRELATION ENGINE
// ============================================================
async function runCorrelationEngine(
  supabase: ReturnType<typeof createClient>,
  freshSignals: Signal[],
  patterns: CorrelationPattern[]
): Promise<Array<{ pattern: CorrelationPattern; protocol_id: string; matched_signals: Signal[] }>> {
  const matches = [];
  const signalsByProtocol = new Map<string, Signal[]>();
  for (const s of freshSignals) {
    signalsByProtocol.set(s.protocol_id, [...(signalsByProtocol.get(s.protocol_id) || []), s]);
  }
  for (const [protocolId, protocolSignals] of signalsByProtocol) {
    for (const pattern of patterns) {
      const dedupKey = `pattern:${pattern.id}:${protocolId}`;
      const { data: deduped } = await supabase.from("alert_dedup")
        .select("dedup_key").eq("dedup_key", dedupKey)
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      if (deduped) continue;

      const matchedSignals: Signal[] = [];
      for (const required of pattern.signals_required) {
        const signal = protocolSignals.find((s) => s.signal_type === required.signal_type);
        if (!signal) continue;
        const meets = required.threshold_pct !== undefined ? signal.value >= required.threshold_pct
          : required.threshold_ms !== undefined ? signal.value >= required.threshold_ms
          : required.threshold_factor !== undefined ? signal.value >= required.threshold_factor
          : true;
        if (meets) matchedSignals.push(signal);
      }
      if (matchedSignals.length >= pattern.min_signals_match) {
        matches.push({ pattern, protocol_id: protocolId, matched_signals: matchedSignals });
      }
    }
  }
  return matches;
}

// ============================================================
// ALERT FIRING
// ============================================================
async function fireAlert(
  supabase: ReturnType<typeof createClient>,
  params: {
    rule_id?: string; pattern_id?: string; protocol_id: string;
    severity: string; title: string; description: string;
    signal_snapshot: unknown; cooldown_seconds: number;
  }
): Promise<string | null> {
  const { data: alert, error } = await supabase.from("alerts").insert({
    rule_id: params.rule_id || null,
    pattern_id: params.pattern_id || null,
    protocol_id: params.protocol_id,
    severity: params.severity,
    title: params.title,
    description: params.description,
    signal_snapshot: params.signal_snapshot,
    fired_at: new Date().toISOString(),
  }).select("id").single();

  if (error || !alert) { console.error("Alert insert failed:", error); return null; }

  const dedupKey = params.rule_id
    ? `${params.rule_id}:${params.protocol_id}`
    : `pattern:${params.pattern_id}:${params.protocol_id}`;
  await supabase.from("alert_dedup").upsert({
    dedup_key: dedupKey,
    alert_id: alert.id,
    expires_at: new Date(Date.now() + params.cooldown_seconds * 1000).toISOString(),
  });

  const { data: subscribers } = await supabase.rpc("get_alert_subscribers", {
    p_protocol_id: params.protocol_id, p_severity: params.severity,
  });
  if (subscribers?.length) {
    await supabase.from("alerts").update({ subscriber_count: subscribers.length }).eq("id", alert.id);
  }

  // Async: invoke alert-router
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/alert-router`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      alert_id: alert.id, protocol_id: params.protocol_id,
      severity: params.severity, title: params.title, description: params.description,
    }),
  }).catch((e) => console.error("Alert router failed:", e));

  return alert.id;
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader  = req.headers.get("Authorization");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret  = Deno.env.get("AEGIS_CRON_SECRET");
  const isAuth      = authHeader === `Bearer ${serviceKey}`
    || req.headers.get("X-Aegis-Cron-Secret") === cronSecret;

  if (!isAuth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId    = crypto.randomUUID();
  const start    = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    await supabase.from("aegis_system_health")
      .update({ status: "healthy", last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("component", "detection");

    const { data: protocols }  = await supabase.from("protocols").select("*").eq("is_active", true);
    const { data: rules }      = await supabase.from("detection_rules").select("*").eq("is_active", true);
    const { data: patterns }   = await supabase.from("correlation_patterns").select("*").eq("is_active", true);
    const { data: baselineRows } = await supabase.from("signal_baselines").select("*");

    if (!protocols?.length) throw new Error("No active protocols found");

    const baselines = new Map<string, SignalBaseline>();
    for (const row of baselineRows || []) {
      baselines.set(`${row.protocol_id}:${row.signal_type}`, row);
    }

    const validatorsToken = Deno.env.get("VALIDATORS_APP_TOKEN");
    const results = await Promise.allSettled([
      ingestDefiLlamaTvl(protocols),
      ingestJupiterPrices(protocols),
      ingestSolanaNetworkHealth(protocols),
      ingestPythOracles(protocols),
      ingestValidatorHealth(protocols, validatorsToken),
      ingestBridgeHealth(protocols),
    ]);

    const allSignals: Signal[] = results
      .flatMap((r) => r.status === "fulfilled" ? r.value : [])
      .slice(0, MAX_SIGNALS_PER_RUN);

    const enrichedSignals = allSignals.map((s) => {
      const b = baselines.get(`${s.protocol_id}:${s.signal_type}`);
      return b && b.stddev_24h > 0
        ? { ...s, baseline: b.mean_24h, zscore: (s.value - b.mean_24h) / b.stddev_24h }
        : s;
    });

    if (enrichedSignals.length > 0) {
      await supabase.from("signals").insert(
        enrichedSignals.map((s) => ({ ...s, recorded_at: new Date().toISOString() }))
      );
    }

    const ruleMatches        = await runRuleEngine(supabase, enrichedSignals, rules || [], baselines);
    const correlationMatches = await runCorrelationEngine(supabase, enrichedSignals, patterns || []);

    let alertsFired = 0;
    for (const m of ruleMatches) {
      const protocol = protocols.find((p) => p.id === m.protocol_id);
      if (!protocol) continue;
      const zStr = m.zscore !== null ? ` (Z=${m.zscore.toFixed(2)})` : "";
      const id = await fireAlert(supabase, {
        rule_id: m.rule.id, protocol_id: m.protocol_id,
        severity: m.rule.severity,
        title: `${m.rule.severity} — ${protocol.name}: ${m.rule.name}`,
        description: `${m.rule.description || m.rule.name}${zStr}. Value: ${m.matched_signal.value.toFixed(4)}`,
        signal_snapshot: { rule_name: m.rule.name, signal: m.matched_signal, zscore: m.zscore },
        cooldown_seconds: m.rule.cooldown_seconds,
      });
      if (id) alertsFired++;
    }

    for (const m of correlationMatches) {
      const protocol = protocols.find((p) => p.id === m.protocol_id);
      if (!protocol) continue;
      const id = await fireAlert(supabase, {
        pattern_id: m.pattern.id, protocol_id: m.protocol_id,
        severity: m.pattern.severity,
        title: `${m.pattern.severity} CORRELATION — ${protocol.name}: ${m.pattern.name}`,
        description: `${m.pattern.description}. ${m.matched_signals.length} correlated signals detected.`,
        signal_snapshot: { pattern_name: m.pattern.name, matched_signals: m.matched_signals },
        cooldown_seconds: 900,
      });
      if (id) {
        alertsFired++;
        await supabase.from("correlation_patterns")
          .update({ fire_count: m.pattern.fire_count + 1 }).eq("id", m.pattern.id);
      }
    }

    const duration = Date.now() - start;
    await supabase.from("aegis_system_health").update({
      status: "healthy", last_success_at: new Date().toISOString(),
      metrics: { signals_ingested: enrichedSignals.length, alerts_fired: alertsFired, duration_ms: duration, run_id: runId },
      updated_at: new Date().toISOString(),
    }).eq("component", "detection");

    return new Response(JSON.stringify({
      run_id: runId, signals_ingested: enrichedSignals.length,
      rule_matches: ruleMatches.length, correlation_matches: correlationMatches.length,
      alerts_fired: alertsFired, duration_ms: duration,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${runId}] Fatal:`, msg);
    await supabase.from("aegis_system_health")
      .update({ status: "degraded", error_message: msg, updated_at: new Date().toISOString() })
      .eq("component", "detection");
    return new Response(JSON.stringify({ error: msg, run_id: runId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
