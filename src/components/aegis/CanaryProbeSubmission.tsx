import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Radio, Send, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';

interface ProbeResult {
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
}

const PROBE_TYPES = [
  { value: 'rpc_health', label: 'RPC Health Check', description: 'Test RPC endpoint availability & latency' },
  { value: 'oracle_feed', label: 'Oracle Feed Check', description: 'Verify oracle price feed freshness' },
  { value: 'program_ping', label: 'Program Ping', description: 'Verify program account is accessible' },
  { value: 'tvl_check', label: 'TVL Snapshot', description: 'Check protocol TVL via DeFiLlama' },
];

export function CanaryProbeSubmission({ apiKey }: { apiKey?: string }) {
  const { publicKey, connected } = useWallet();
  const [probeType, setProbeType] = useState('');
  const [protocolSlug, setProtocolSlug] = useState('');
  const [storedApiKey, setStoredApiKey] = useState(apiKey || '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [rawResult, setRawResult] = useState('');

  const handleSubmitProbe = async () => {
    if (!connected || !publicKey) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!probeType || !protocolSlug.trim() || !storedApiKey.trim()) {
      toast.error('Fill in all required fields');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const start = Date.now();
      const timestamp = Math.floor(Date.now() / 1000);

      // Look up the node_id from the API key by querying canary_nodes for this wallet
      const walletAddr = publicKey.toBase58();
      const { data: nodeData } = await supabase
        .from('canary_nodes')
        .select('node_id')
        .eq('wallet_address', walletAddr)
        .limit(1)
        .maybeSingle();

      if (!nodeData) {
        toast.error('No registered canary node found for this wallet');
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('canary-ingest', {
        body: {
          node_id: nodeData.node_id,
          protocol_slug: protocolSlug.trim(),
          probe_name: probeType,
          success: true,
          latency_ms: Date.now() - start,
          raw_result: rawResult ? JSON.parse(rawResult) : {},
          timestamp,
          signature: `browser-${timestamp}-${walletAddr.slice(0, 8)}`,
          version: '1.0.0-browser',
        },
      });

      const latency = Date.now() - start;

      if (error) {
        setResult({ success: false, latencyMs: latency, errorMessage: error.message });
        toast.error('Probe submission failed');
      } else {
        setResult({ success: true, latencyMs: latency });
        toast.success('Probe submitted successfully');
      }
    } catch (e) {
      setResult({
        success: false,
        latencyMs: 0,
        errorMessage: e instanceof Error ? e.message : 'Unknown error',
      });
      toast.error('Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">Submit Probe</h3>
          <p className="text-[10px] text-muted-foreground font-mono">Run a probe and submit results to the canary network</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!connected ? (
          <p className="text-xs text-amber-400 font-mono text-center py-4">Connect your wallet to submit probes</p>
        ) : (
          <>
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5 block">
                API Key
              </label>
              <Input
                type="password"
                value={storedApiKey}
                onChange={(e) => setStoredApiKey(e.target.value)}
                placeholder="Your canary node API key"
                className="font-mono text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5 block">
                  Probe Type
                </label>
                <Select value={probeType} onValueChange={setProbeType}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Select probe" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROBE_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div>
                          <span className="text-xs">{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5 block">
                  Protocol Slug
                </label>
                <Input
                  value={protocolSlug}
                  onChange={(e) => setProtocolSlug(e.target.value)}
                  placeholder="e.g. raydium"
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5 block">
                Raw Result (JSON, optional)
              </label>
              <Textarea
                value={rawResult}
                onChange={(e) => setRawResult(e.target.value)}
                placeholder='{"status": "ok", "block_height": 123456}'
                className="font-mono text-xs min-h-[60px] resize-none"
              />
            </div>

            <Button
              onClick={handleSubmitProbe}
              disabled={submitting}
              className="w-full font-display font-semibold tracking-wider"
              size="sm"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              {submitting ? 'Submitting...' : 'Submit Probe'}
            </Button>

            {/* Result */}
            {result && (
              <div className={cn(
                'rounded-md border p-3 flex items-start gap-2',
                result.success
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              )}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <p className={cn('font-semibold', result.success ? 'text-emerald-400' : 'text-red-400')}>
                    {result.success ? 'Probe Accepted' : 'Probe Failed'}
                  </p>
                  <p className="text-muted-foreground font-mono mt-0.5">
                    Latency: {result.latencyMs}ms
                    {result.errorMessage && ` — ${result.errorMessage}`}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
