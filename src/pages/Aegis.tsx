import { Layout } from '@/components/layout/Layout';
import { SystemHealthBar, ProtocolHealthGrid, AlertFeed, CanaryStatus, SubscriptionPanel } from '@/components/aegis';
import { Shield, Activity, Radio, Bell } from 'lucide-react';

export default function Aegis() {
  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                AEGIS
              </h1>
              <p className="text-sm text-muted-foreground font-mono tracking-wider">
                SOLANA EARLY WARNING SYSTEM
              </p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Decentralized, crowdsourced detection engine monitoring 14 protocols across DeFi, bridges, oracles, and validators.
            Real-time Z-score anomaly detection + cross-signal correlation.
          </p>
        </div>

        {/* Wallet-Native Subscription CTA */}
        <section className="mb-10">
          <SubscriptionPanel />
        </section>

        {/* System Health */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              System Status
            </h2>
          </div>
          <SystemHealthBar />
        </section>

        {/* Protocol Health Grid */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Protocol Health
            </h2>
          </div>
          <ProtocolHealthGrid />
        </section>

        {/* Two-column: Alert Feed + Canary Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Alert Feed — 2/3 width */}
          <section className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Live Alert Feed
              </h2>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                REALTIME
              </span>
            </div>
            <AlertFeed />
          </section>

          {/* Canary Network — 1/3 width */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Canary Network
              </h2>
            </div>
            <CanaryStatus />
          </section>
        </div>
      </div>
    </Layout>
  );
}
