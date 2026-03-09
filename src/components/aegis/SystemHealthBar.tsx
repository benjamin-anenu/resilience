import { useEffect, useState } from 'react';
import { Shield, Activity, Bell, Radio, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface HealthComponent {
  component: string;
  status: string;
  last_run_at: string | null;
  last_success_at: string | null;
  metrics: Record<string, unknown>;
}

const COMPONENT_META: Record<string, { label: string; icon: React.ElementType }> = {
  ingestion:    { label: 'Ingestion',    icon: Activity },
  detection:    { label: 'Detection',    icon: Shield },
  notification: { label: 'Notification', icon: Bell },
  canary:       { label: 'Canary Net',   icon: Radio },
  database:     { label: 'Database',     icon: Database },
};

export function SystemHealthBar() {
  const [components, setComponents] = useState<HealthComponent[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('aegis_system_health').select('*');
      if (data) setComponents(data as HealthComponent[]);
    };
    fetch();

    const channel = supabase
      .channel('aegis-health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aegis_system_health' }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex flex-wrap gap-3">
      {components.map((c) => {
        const meta = COMPONENT_META[c.component] || { label: c.component, icon: Activity };
        const Icon = meta.icon;
        return (
          <div
            key={c.component}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-mono',
              c.status === 'healthy' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
              c.status === 'degraded' && 'border-amber-500/30 bg-amber-500/5 text-amber-400',
              c.status === 'down' && 'border-red-500/30 bg-red-500/5 text-red-400',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-semibold">{meta.label}</span>
            <span className={cn(
              'h-2 w-2 rounded-full',
              c.status === 'healthy' && 'bg-emerald-400 animate-pulse',
              c.status === 'degraded' && 'bg-amber-400',
              c.status === 'down' && 'bg-red-400',
            )} />
          </div>
        );
      })}
    </div>
  );
}
