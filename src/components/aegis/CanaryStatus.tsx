import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Radio, Globe, Trophy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CanaryNode {
  id: string;
  node_id: string;
  reputation_score: number;
  total_reports: number;
  accurate_reports: number;
  geographic_region: string | null;
  status: string;
  last_seen_at: string | null;
}

export function CanaryStatus() {
  const [canaries, setCanaries] = useState<CanaryNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCanaries = async () => {
      // Use the public-safe view that hides wallet_address and api_key_hash
      const { data } = await supabase
        .from('canary_nodes_public' as any)
        .select('id, node_id, reputation_score, total_reports, accurate_reports, geographic_region, status, last_seen_at')
        .eq('status', 'ACTIVE')
        .order('reputation_score', { ascending: false })
        .limit(10);
      if (data) setCanaries(data as CanaryNode[]);
      setLoading(false);
    };
    fetchCanaries();
  }, []);

  const activeCount = canaries.length;
  const regions = [...new Set(canaries.map((c) => c.geographic_region).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Radio className="h-5 w-5 mx-auto mb-2 text-emerald-400" />
          <p className="font-mono text-2xl font-bold text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Active Nodes</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Globe className="h-5 w-5 mx-auto mb-2 text-blue-400" />
          <p className="font-mono text-2xl font-bold text-foreground">{regions.length}</p>
          <p className="text-xs text-muted-foreground">Regions</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Trophy className="h-5 w-5 mx-auto mb-2 text-amber-400" />
          <p className="font-mono text-2xl font-bold text-foreground">
            {canaries.length > 0 ? canaries.reduce((s, c) => s + c.total_reports, 0).toLocaleString() : '0'}
          </p>
          <p className="text-xs text-muted-foreground">Total Reports</p>
        </div>
      </div>

      {/* Leaderboard */}
      {canaries.length > 0 ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="font-display text-sm font-semibold text-foreground">Top Canary Operators</h4>
          </div>
          <div className="divide-y divide-border">
            {canaries.slice(0, 5).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{c.node_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.geographic_region || 'Unknown'} · {c.total_reports} reports
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-emerald-400">{c.reputation_score.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">reputation</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <Radio className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <h4 className="font-display text-sm font-semibold text-foreground mb-1">No Canary Nodes Yet</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Be among the first to run a canary node and contribute to the Solana early warning network.
          </p>
        </div>
      )}

      {/* CTA */}
      <Button
        variant="outline"
        className="w-full font-display font-semibold tracking-wider border-primary/30 hover:bg-primary/5"
        onClick={() => window.open('https://github.com', '_blank')}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        RUN A CANARY NODE
      </Button>
    </div>
  );
}
