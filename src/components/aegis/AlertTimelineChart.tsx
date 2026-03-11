import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface DayBucket {
  date: string;
  P1: number;
  P2: number;
  P3: number;
  INFO: number;
}

export function AlertTimelineChart() {
  const [data, setData] = useState<DayBucket[]>([]);

  useEffect(() => {
    const load = async () => {
      const since = subDays(new Date(), 14).toISOString();
      const { data: alerts } = await supabase
        .from('alerts')
        .select('fired_at, severity')
        .gte('fired_at', since)
        .order('fired_at', { ascending: true });

      if (!alerts) return;

      // Build 14-day buckets
      const buckets: Record<string, DayBucket> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(startOfDay(subDays(new Date(), i)), 'MMM dd');
        buckets[d] = { date: d, P1: 0, P2: 0, P3: 0, INFO: 0 };
      }

      alerts.forEach((a) => {
        const d = format(startOfDay(new Date(a.fired_at)), 'MMM dd');
        if (buckets[d] && (a.severity === 'P1' || a.severity === 'P2' || a.severity === 'P3' || a.severity === 'INFO')) {
          buckets[d][a.severity as keyof Omit<DayBucket, 'date'>]++;
        }
      });

      setData(Object.values(buckets));
    };
    load();
  }, []);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-center h-[260px]">
        <p className="text-sm text-muted-foreground">Loading timeline...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Alert Volume — 14 Days
      </h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area type="monotone" dataKey="P1" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
            <Area type="monotone" dataKey="P2" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
            <Area type="monotone" dataKey="P3" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.2} />
            <Area type="monotone" dataKey="INFO" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
