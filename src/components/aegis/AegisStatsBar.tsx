import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertTriangle, Radio, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  totalAlerts: number;
  activeAlerts: number;
  protocolsMonitored: number;
  canaryNodesOnline: number;
  p1Active: number;
}

export function AegisStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const [alertsRes, protocolsRes, nodesRes] = await Promise.all([
        supabase.from('alerts').select('id, status, severity', { count: 'exact' }),
        supabase.from('protocols').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('canary_nodes').select('id', { count: 'exact' }).eq('status', 'ACTIVE'),
      ]);

      const allAlerts = alertsRes.data || [];
      const active = allAlerts.filter((a) => a.status === 'FIRING');
      const p1 = active.filter((a) => a.severity === 'P1');

      setStats({
        totalAlerts: allAlerts.length,
        activeAlerts: active.length,
        protocolsMonitored: protocolsRes.count || 0,
        canaryNodesOnline: nodesRes.count || 0,
        p1Active: p1.length,
      });
    };
    load();
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  const items = [
    {
      label: 'Protocols Monitored',
      value: stats.protocolsMonitored,
      icon: Shield,
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/20',
    },
    {
      label: 'Active Alerts',
      value: stats.activeAlerts,
      icon: AlertTriangle,
      color: stats.activeAlerts > 0 ? 'text-red-400' : 'text-emerald-400',
      bg: stats.activeAlerts > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'P1 Critical',
      value: stats.p1Active,
      icon: Activity,
      color: stats.p1Active > 0 ? 'text-red-400' : 'text-emerald-400',
      bg: stats.p1Active > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Canary Nodes',
      value: stats.canaryNodesOnline,
      icon: Radio,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn('rounded-lg border bg-card p-4 flex items-center gap-3')}
          >
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', item.bg)}>
              <Icon className={cn('h-5 w-5', item.color)} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{item.value}</p>
              <p className="text-[11px] text-muted-foreground font-mono tracking-wide">{item.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
