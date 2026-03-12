const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { Keypair } = await import("https://esm.sh/@solana/web3.js@1.98.0");
    const keypair = Keypair.generate();
    
    const publicKey = keypair.publicKey.toBase58();
    const secretKeyArray = Array.from(keypair.secretKey);

    return new Response(JSON.stringify({
      public_key: publicKey,
      secret_key_json: JSON.stringify(secretKeyArray),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
