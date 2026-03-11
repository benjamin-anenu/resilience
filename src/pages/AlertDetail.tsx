import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, Shield, Clock, Bell, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriageControls } from '@/components/aegis/AlertTriageControls';

interface AlertDetail {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  fired_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  signal_snapshot: Record<string, unknown>;
  subscriber_count: number;
  onchain_signature: string | null;
  protocol_name?: string;
  protocol_slug?: string;
  protocol_category?: string;
}

interface NotifLog {
  id: string;
  channel: string;
  destination: string;
  status: string;
  sent_at: string;
  error_message: string | null;
}

const SEVERITY_STYLES: Record<string, { badge: string; border: string }> = {
  P1: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', border: 'border-l-red-500' },
  P2: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', border: 'border-l-amber-500' },
  P3: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', border: 'border-l-yellow-500' },
  INFO: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', border: 'border-l-blue-500' },
};

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [notifs, setNotifs] = useState<NotifLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      // Fetch from the view first for protocol info
      const { data: viewData } = await supabase
        .from('v_active_alerts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      // Also get full alert record
      const { data: alertData } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', id)
        .single();

      if (alertData) {
        setAlert({
          ...alertData,
          protocol_name: viewData?.protocol_name || 'Unknown',
          protocol_slug: viewData?.protocol_slug || '',
          protocol_category: viewData?.protocol_category || '',
        } as AlertDetail);
      }

      // Notification log (service role only — will be empty for anon, that's fine)
      const { data: notifData } = await supabase
        .from('aegis_notification_log')
        .select('id, channel, destination, status, sent_at, error_message')
        .eq('alert_id', id)
        .order('sent_at', { ascending: false });

      if (notifData) setNotifs(notifData as NotifLog[]);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16">
          <div className="h-64 rounded-lg border border-border bg-card animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!alert) {
    return (
      <Layout>
        <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16 text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Alert Not Found</h1>
          <Link to="/aegis" className="text-primary text-sm hover:underline">← Back to Aegis</Link>
        </div>
      </Layout>
    );
  }

  const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;
  const snapshot = alert.signal_snapshot || {};

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16 max-w-4xl">
        {/* Back */}
        <Link to="/aegis" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Aegis
        </Link>

        {/* Header */}
        <div className={cn('rounded-lg border bg-card p-6 border-l-4 mb-6', styles.border)}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-xs font-mono font-bold', styles.badge)}>
                  {alert.severity}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  {alert.status}
                </Badge>
                {alert.protocol_name && (
                  <span className="text-xs text-muted-foreground font-mono">{alert.protocol_name}</span>
                )}
              </div>
              <h1 className="text-xl font-display font-bold text-foreground">{alert.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('h-8 w-8 shrink-0', styles.badge.includes('red') ? 'text-red-400' : 'text-amber-400')} />
              <AlertTriageControls
                alertId={alert.id}
                currentStatus={alert.status}
                currentSeverity={alert.severity}
                onUpdated={() => window.location.reload()}
              />
            </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Fired {format(new Date(alert.fired_at), 'MMM dd, yyyy HH:mm:ss')}
            </span>
            {alert.resolved_at && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Shield className="h-3 w-3" /> Resolved {formatDistanceToNow(new Date(alert.resolved_at), { addSuffix: true })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Bell className="h-3 w-3" /> {alert.subscriber_count} notified
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Signal Snapshot */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Signal Snapshot
            </h2>
            {Object.keys(snapshot).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(snapshot).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-mono text-xs">{key}</span>
                    <span className="font-mono font-semibold text-foreground text-xs">
                      {typeof val === 'number' ? val.toFixed(4) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No signal data captured</p>
            )}
          </div>

          {/* On-Chain Receipt */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              On-Chain Receipt
            </h2>
            {alert.onchain_signature ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Transaction signature:</p>
                <code className="text-xs font-mono text-foreground break-all bg-muted/50 p-2 rounded block">
                  {alert.onchain_signature}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open(`https://solscan.io/tx/${alert.onchain_signature}`, '_blank')}
                >
                  <ExternalLink className="mr-1.5 h-3 w-3" /> View on Solscan
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No on-chain receipt recorded for this alert</p>
            )}
          </div>
        </div>

        {/* Notification Delivery Log */}
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Notification Delivery Log
          </h2>
          {notifs.length > 0 ? (
            <div className="divide-y divide-border">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{n.channel}</Badge>
                    <span className="text-muted-foreground font-mono truncate max-w-[200px]">{n.destination}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-mono',
                        n.status === 'sent' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                        n.status === 'failed' && 'bg-red-500/10 text-red-400 border-red-500/20',
                      )}
                    >
                      {n.status}
                    </Badge>
                    <span className="text-muted-foreground/60 font-mono">
                      {format(new Date(n.sent_at), 'HH:mm:ss')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No notification records available (service-level data)</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
