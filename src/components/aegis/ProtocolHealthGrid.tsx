import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProtocolHealth {
  id: string;
  slug: string;
  name: string;
  category: string;
  logo_url: string | null;
  program_address: string | null;
  active_p1: number;
  active_p2: number;
  active_p3: number;
  last_alert_at: string | null;
  canary_failures_1h: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  DEX: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BRIDGE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ORACLE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  VALIDATOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  RPC: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  LENDING: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  LIQUID_STAKING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  INFRASTRUCTURE: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function getHealthStatus(p: ProtocolHealth) {
  if (p.active_p1 > 0) return 'critical';
  if (p.active_p2 > 0) return 'warning';
  if (p.active_p3 > 0) return 'watch';
  return 'healthy';
}

export function ProtocolHealthGrid() {
  const [protocols, setProtocols] = useState<ProtocolHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('v_protocol_health').select('*');
      if (data) setProtocols(data as ProtocolHealth[]);
      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel('aegis-alerts-change')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {protocols.map((p) => {
        const status = getHealthStatus(p);
        return (
          <div
            key={p.id}
            className={cn(
              'rounded-lg border bg-card p-4 transition-all hover:shadow-lg',
              status === 'critical' && 'border-red-500/40 shadow-red-500/10',
              status === 'warning' && 'border-amber-500/30 shadow-amber-500/10',
              status === 'watch' && 'border-yellow-500/20',
              status === 'healthy' && 'border-border hover:border-primary/30',
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md border',
                  status === 'healthy' && 'border-emerald-500/30 bg-emerald-500/10',
                  status === 'critical' && 'border-red-500/30 bg-red-500/10',
                  status === 'warning' && 'border-amber-500/30 bg-amber-500/10',
                  status === 'watch' && 'border-yellow-500/30 bg-yellow-500/10',
                )}>
                  {status === 'healthy' ? (
                    <Shield className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className={cn(
                      'h-4 w-4',
                      status === 'critical' && 'text-red-400',
                      status === 'warning' && 'text-amber-400',
                      status === 'watch' && 'text-yellow-400',
                    )} />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">{p.name}</h3>
                  <Badge variant="outline" className={cn('text-[10px] mt-0.5', CATEGORY_COLORS[p.category])}>
                    {p.category.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {p.active_p1 > 0 && (
                <span className="flex items-center gap-1 text-red-400 font-mono font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  P1: {p.active_p1}
                </span>
              )}
              {p.active_p2 > 0 && (
                <span className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  P2: {p.active_p2}
                </span>
              )}
              {p.active_p3 > 0 && (
                <span className="flex items-center gap-1 text-yellow-400 font-mono">
                  P3: {p.active_p3}
                </span>
              )}
              {status === 'healthy' && (
                <span className="text-emerald-400 font-mono">ALL CLEAR</span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {p.last_alert_at
                  ? formatDistanceToNow(new Date(p.last_alert_at), { addSuffix: true })
                  : 'No alerts'}
              </span>
              {p.canary_failures_1h > 0 && (
                <span className="text-amber-400 font-mono">
                  🐤 {p.canary_failures_1h} fail
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
