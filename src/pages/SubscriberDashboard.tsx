import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Shield, Bell, ArrowLeft, Wallet, AlertTriangle,
  Send, MessageSquare, Clock, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

interface Subscription {
  id: string;
  protocol_id: string;
  min_severity: string;
  is_active: boolean;
  auto_detected: boolean;
  created_at: string;
}

interface Channel {
  id: string;
  channel: string;
  destination: string;
  is_active: boolean;
  is_verified: boolean;
  min_severity: string;
}

interface NotifHistoryItem {
  id: string;
  channel: string;
  destination: string;
  status: string;
  sent_at: string;
  error_message: string | null;
  alert_id: string;
}

interface Protocol {
  id: string;
  name: string;
  slug: string;
  category: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  TELEGRAM: Send,
  DISCORD: MessageSquare,
  EMAIL: Bell,
  WEBHOOK: Shield,
  PUSH: Bell,
};

export default function SubscriberDashboard() {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(true);
  const [subscriber, setSubscriber] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [notifHistory, setNotifHistory] = useState<NotifHistoryItem[]>([]);

  const loadData = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);

    try {
      // Fetch subscriber by wallet
      const { data, error } = await supabase.functions.invoke('manage-aegis-subscriptions', {
        body: { action: 'scan', wallet_address: publicKey.toBase58() },
      });

      if (data?.existing_subscriber) {
        setSubscriber(data.existing_subscriber);
      }

      // Load protocols for name mapping
      const { data: protoData } = await supabase.from('protocols').select('id, name, slug, category');
      if (protoData) setProtocols(protoData as Protocol[]);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) loadData();
    else setLoading(false);
  }, [connected, publicKey, loadData]);

  const getProtocolName = (id: string) => {
    const p = protocols.find((p) => p.id === id);
    return p?.name || id.slice(0, 8) + '...';
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16 max-w-4xl">
        <Link to="/aegis" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Aegis
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 shadow-lg shadow-primary/5">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              My Subscriptions
            </h1>
            <p className="text-xs text-muted-foreground font-mono tracking-wider">
              AEGIS ALERT PREFERENCES
            </p>
          </div>
        </div>

        {!connected ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-16 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">Connect Your Wallet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Connect the wallet you used to subscribe to view and manage your alert preferences.
            </p>
            <WalletMultiButton />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : !subscriber ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-16 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">No Subscription Found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              This wallet doesn't have any active Aegis subscriptions yet.
            </p>
            <Link to="/aegis">
              <Button>
                <Shield className="mr-2 h-4 w-4" />
                Subscribe on Aegis
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subscriber Card */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  Subscriber Profile
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-mono',
                    subscriber.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  )}
                >
                  {subscriber.is_active ? 'ACTIVE' : 'PAUSED'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Wallet</p>
                  <p className="font-mono text-foreground text-xs">
                    {subscriber.wallet_address?.slice(0, 6)}...{subscriber.wallet_address?.slice(-4)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Nickname</p>
                  <p className="text-foreground text-xs">{subscriber.nickname || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Min Severity</p>
                  <Badge variant="outline" className={cn('text-[10px]', SEVERITY_COLORS[subscriber.global_min_severity] || '')}>
                    {subscriber.global_min_severity || 'P2'}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Since</p>
                  <p className="text-foreground text-xs font-mono">
                    {subscriber.created_at ? format(new Date(subscriber.created_at), 'MMM dd, yyyy') : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Info about service-level data */}
            <div className="rounded-md border border-border/50 bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Detailed subscription data, notification channels, and delivery history are managed server-side.
                <br />
                Use the subscription panel on the <Link to="/aegis" className="text-primary hover:underline">Aegis page</Link> to update your preferences.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
