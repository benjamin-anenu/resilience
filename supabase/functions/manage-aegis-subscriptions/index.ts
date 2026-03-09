// ============================================================
// AEGIS — SUBSCRIPTION MANAGER (Edge Function)
// Wallet-native subscriptions: scan positions → auto-subscribe
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known token mints → protocol slugs (Solana mainnet)
const TOKEN_TO_PROTOCOL: Record<string, string> = {
  // Raydium
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "raydium",
  // Orca
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE": "orca",
  // Jupiter
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "jupiter",
  // Marinade (mSOL)
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": "marinade",
  // Jito (jitoSOL)
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "jito",
  // Pyth
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": "pyth",
  // Drift
  "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7": "drift",
};

// Program IDs → protocol slugs
const PROGRAM_TO_PROTOCOL: Record<string, string> = {
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "raydium",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "orca",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "jupiter",
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD": "marinade",
  "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb": "jito",
  "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH": "pyth",
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH": "drift",
  "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb": "wormhole",
};

interface ManageRequest {
  action: "scan" | "subscribe" | "unsubscribe" | "get_subscriptions";
  wallet_address?: string;
  subscriber_id?: string;
  // For subscribe action
  nickname?: string;
  telegram_chat_id?: string;
  discord_webhook?: string;
  email?: string;
  protocol_ids?: string[];
  min_severity?: string;
  // For unsubscribe
  subscription_id?: string;
}

interface DetectedPosition {
  protocol_slug: string;
  protocol_name: string;
  protocol_id: string;
  source: "token" | "program_interaction";
  details: string;
}

async function scanWalletPositions(walletAddress: string, supabase: any): Promise<DetectedPosition[]> {
  const positions: DetectedPosition[] = [];
  const foundSlugs = new Set<string>();

  // Fetch protocols from DB for slug → id mapping
  const { data: protocols } = await supabase.from("protocols").select("id, slug, name").eq("is_active", true);
  const slugToProtocol = new Map(protocols?.map((p: any) => [p.slug, p]) || []);

  // 1. Scan token accounts via Solana RPC (free public endpoint)
  try {
    const rpcUrl = Deno.env.get("RPC_URL") || "https://api.mainnet-beta.solana.com";
    const tokenRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed", commitment: "confirmed" }
        ]
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData?.result?.value) {
      for (const account of tokenData.result.value) {
        const info = account.account?.data?.parsed?.info;
        if (!info) continue;
        const mint = info.mint;
        const amount = parseFloat(info.tokenAmount?.uiAmountString || "0");
        if (amount <= 0) continue;

        const slug = TOKEN_TO_PROTOCOL[mint];
        if (slug && !foundSlugs.has(slug)) {
          const proto = slugToProtocol.get(slug);
          if (proto) {
            foundSlugs.add(slug);
            positions.push({
              protocol_slug: slug,
              protocol_name: (proto as any).name,
              protocol_id: (proto as any).id,
              source: "token",
              details: `Holds ${amount.toLocaleString()} ${slug.toUpperCase()} tokens`,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Token scan error:", e);
  }

  // 2. Check recent transaction history for program interactions
  try {
    const rpcUrl = Deno.env.get("RPC_URL") || "https://api.mainnet-beta.solana.com";
    const txRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2,
        method: "getSignaturesForAddress",
        params: [walletAddress, { limit: 50, commitment: "confirmed" }]
      }),
    });
    const txData = await txRes.json();

    if (txData?.result) {
      // Get transaction details for program interaction detection
      const sigs = txData.result.slice(0, 20).map((s: any) => s.signature);
      for (const sig of sigs) {
        try {
          const detailRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 3,
              method: "getTransaction",
              params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]
            }),
          });
          const detail = await detailRes.json();
          const programIds = detail?.result?.transaction?.message?.accountKeys
            ?.filter((k: any) => k.signer === false)
            ?.map((k: any) => k.pubkey) || [];

          for (const pid of programIds) {
            const slug = PROGRAM_TO_PROTOCOL[pid];
            if (slug && !foundSlugs.has(slug)) {
              const proto = slugToProtocol.get(slug);
              if (proto) {
                foundSlugs.add(slug);
                positions.push({
                  protocol_slug: slug,
                  protocol_name: (proto as any).name,
                  protocol_id: (proto as any).id,
                  source: "program_interaction",
                  details: `Recent interaction with ${(proto as any).name}`,
                });
              }
            }
          }
        } catch { /* skip individual tx errors */ }
      }
    }
  } catch (e) {
    console.error("Transaction scan error:", e);
  }

  // 3. Always suggest critical infrastructure protocols
  for (const infra of ["solana-validators", "wormhole"]) {
    if (!foundSlugs.has(infra)) {
      const proto = slugToProtocol.get(infra);
      if (proto) {
        positions.push({
          protocol_slug: infra,
          protocol_name: (proto as any).name,
          protocol_id: (proto as any).id,
          source: "program_interaction",
          details: "Critical infrastructure — recommended",
        });
      }
    }
  }

  return positions;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body: ManageRequest = await req.json();

    // ── SCAN: Detect wallet positions ──
    if (body.action === "scan") {
      if (!body.wallet_address) {
        return new Response(JSON.stringify({ error: "wallet_address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const positions = await scanWalletPositions(body.wallet_address, supabase);

      // Check if subscriber already exists
      const { data: existing } = await supabase
        .from("aegis_subscribers")
        .select("id, nickname, global_min_severity, wallet_last_scanned_at")
        .eq("wallet_address", body.wallet_address)
        .maybeSingle();

      return new Response(JSON.stringify({
        positions,
        existing_subscriber: existing || null,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SUBSCRIBE: Create/update subscriber + channels + protocol subscriptions ──
    if (body.action === "subscribe") {
      if (!body.wallet_address) {
        return new Response(JSON.stringify({ error: "wallet_address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Upsert subscriber
      const { data: subscriber, error: subErr } = await supabase
        .from("aegis_subscribers")
        .upsert({
          wallet_address: body.wallet_address,
          nickname: body.nickname || body.wallet_address.slice(0, 8) + "...",
          global_min_severity: body.min_severity || "P2",
          is_active: true,
          wallet_last_scanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "wallet_address" })
        .select("id")
        .single();

      if (subErr) {
        return new Response(JSON.stringify({ error: subErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subscriberId = subscriber.id;

      // 2. Upsert notification channels
      const channels: Array<{ subscriber_id: string; channel: string; destination: string; is_active: boolean; is_verified: boolean; min_severity: string }> = [];

      if (body.telegram_chat_id) {
        channels.push({
          subscriber_id: subscriberId,
          channel: "TELEGRAM",
          destination: body.telegram_chat_id,
          is_active: true,
          is_verified: true,
          min_severity: body.min_severity || "P2",
        });
      }

      if (body.discord_webhook) {
        channels.push({
          subscriber_id: subscriberId,
          channel: "DISCORD",
          destination: body.discord_webhook,
          is_active: true,
          is_verified: true,
          min_severity: body.min_severity || "P2",
        });
      }

      if (body.email) {
        channels.push({
          subscriber_id: subscriberId,
          channel: "EMAIL",
          destination: body.email,
          is_active: true,
          is_verified: false,
          min_severity: body.min_severity || "P2",
        });
      }

      // Remove old channels for this subscriber, then insert new ones
      if (channels.length > 0) {
        await supabase
          .from("aegis_subscription_channels")
          .delete()
          .eq("subscriber_id", subscriberId);

        const { error: chanErr } = await supabase
          .from("aegis_subscription_channels")
          .insert(channels);

        if (chanErr) console.error("Channel insert error:", chanErr.message);
      }

      // 3. Set up protocol subscriptions
      if (body.protocol_ids && body.protocol_ids.length > 0) {
        // Remove old protocol subscriptions
        await supabase
          .from("aegis_protocol_subscriptions")
          .delete()
          .eq("subscriber_id", subscriberId);

        const protoSubs = body.protocol_ids.map((pid: string) => ({
          subscriber_id: subscriberId,
          protocol_id: pid,
          min_severity: body.min_severity || "P2",
          auto_detected: true,
          is_active: true,
        }));

        const { error: protoErr } = await supabase
          .from("aegis_protocol_subscriptions")
          .insert(protoSubs);

        if (protoErr) console.error("Protocol sub insert error:", protoErr.message);
      }

      return new Response(JSON.stringify({
        subscriber_id: subscriberId,
        channels_configured: channels.length,
        protocols_subscribed: body.protocol_ids?.length || 0,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET_SUBSCRIPTIONS: Fetch current subscriber state ──
    if (body.action === "get_subscriptions") {
      if (!body.wallet_address) {
        return new Response(JSON.stringify({ error: "wallet_address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subscriber } = await supabase
        .from("aegis_subscribers")
        .select("*")
        .eq("wallet_address", body.wallet_address)
        .maybeSingle();

      if (!subscriber) {
        return new Response(JSON.stringify({ subscriber: null, channels: [], protocols: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: channels }, { data: protoSubs }] = await Promise.all([
        supabase.from("aegis_subscription_channels").select("*").eq("subscriber_id", subscriber.id),
        supabase.from("aegis_protocol_subscriptions").select("*, protocols(name, slug, logo_url, category)").eq("subscriber_id", subscriber.id),
      ]);

      return new Response(JSON.stringify({
        subscriber,
        channels: channels || [],
        protocols: protoSubs || [],
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UNSUBSCRIBE: Deactivate subscriber ──
    if (body.action === "unsubscribe") {
      if (!body.wallet_address) {
        return new Response(JSON.stringify({ error: "wallet_address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("aegis_subscribers")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("wallet_address", body.wallet_address);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
