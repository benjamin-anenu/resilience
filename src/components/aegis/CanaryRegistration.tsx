import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Radio, Globe, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const REGIONS = ['US-EAST', 'US-WEST', 'EU-WEST', 'EU-CENTRAL', 'ASIA-SE', 'ASIA-NE', 'OCEANIA', 'LATAM'];

export function CanaryRegistration() {
  const { publicKey, connected } = useWallet();
  const [nodeId, setNodeId] = useState('');
  const [region, setRegion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleRegister = async () => {
    if (!connected || !publicKey) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!nodeId.trim() || !region) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const generatedKey = crypto.randomUUID() + '-' + crypto.randomUUID();
      const keyHash = await hashKey(generatedKey);

      const { data, error } = await supabase.functions.invoke('register-canary-node', {
        body: {
          node_id: nodeId.trim(),
          wallet_address: publicKey.toBase58(),
          api_key_hash: keyHash,
          geographic_region: region,
        },
      });

      if (error) {
        toast.error('Registration failed: ' + error.message);
        return;
      }

      if (data?.error) {
        if (data.code === '23505') {
          toast.error('Node ID already exists');
        } else {
          toast.error('Registration failed: ' + data.error);
        }
        return;
      }

      setApiKey(generatedKey);
      setRegistered(true);
      toast.success('Canary node registered! Save your API key.');
    } catch (err) {
      toast.error('Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  if (registered) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h3 className="font-display text-sm font-semibold text-emerald-400">Node Registered</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Save your API key below — it won't be shown again. Use it to authenticate probe submissions.
        </p>
        <code className="block text-xs font-mono text-foreground bg-muted/50 p-3 rounded break-all mb-3">
          {apiKey}
        </code>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
            PENDING
          </Badge>
          <span>Your node will be activated after initial probe verification</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="h-5 w-5 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Register a Canary Node</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Join the decentralized monitoring network. Run probes against Solana protocols and build reputation.
      </p>

      {!connected ? (
        <p className="text-xs text-amber-400 font-mono">Connect your wallet to register a node</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">Node ID</label>
            <Input
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="my-canary-node-01"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">Region</label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      {r}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Wallet: <span className="text-foreground">{publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-4)}</span>
          </div>
          <Button
            onClick={handleRegister}
            disabled={submitting}
            className="w-full font-display font-semibold tracking-wider"
          >
            {submitting ? 'Registering...' : 'Register Node'}
          </Button>
        </div>
      )}
    </div>
  );
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
