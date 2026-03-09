import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Radio } from 'lucide-react';

interface Alert {
  id: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  subscriber_count: number;
  fired_at: string;
  protocol_name: string;
  protocol_slug: string;
  protocol_category: string;
}

const SEVERITY_STYLES: Record<string, { badge: string; border: string; icon: string }> = {
  P1: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', border: 'border-l-red-500', icon: 'text-red-400' },
  P2: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', border: 'border-l-amber-500', icon: 'text-amber-400' },
  P3: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', border: 'border-l-yellow-500', icon: 'text-yellow-400' },
  INFO: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', border: 'border-l-blue-500', icon: 'text-blue-400' },
};

export function AlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase.from('v_active_alerts').select('*').limit(50);
      if (data) setAlerts(data as Alert[]);
      setLoading(false);
    };
    fetchAlerts();

    const channel = supabase
      .channel('aegis-live-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => fetchAlerts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-4">
          <Radio className="h-8 w-8 text-emerald-400" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">All Clear</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          No active alerts across the Solana ecosystem. The detection engine is monitoring 14 protocols in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;
        return (
          <div
            key={alert.id}
            className={cn(
              'rounded-lg border border-border bg-card p-4 border-l-4 transition-colors hover:bg-card/80',
              styles.border,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className={cn('text-[10px] font-mono font-bold', styles.badge)}>
                    {alert.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{alert.protocol_name}</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground truncate">{alert.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>
              </div>
              <div className="text-right shrink-0">
                <AlertTriangle className={cn('h-4 w-4 mb-1', styles.icon)} />
                <p className="text-[10px] text-muted-foreground/60 font-mono">
                  {formatDistanceToNow(new Date(alert.fired_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {alert.subscriber_count > 0 && (
              <p className="text-[10px] text-muted-foreground/40 mt-2 font-mono">
                → {alert.subscriber_count} subscriber{alert.subscriber_count !== 1 ? 's' : ''} notified
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
