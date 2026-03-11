import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const SEVERITY_COLORS: Record<string, string> = {
  P1: '#ef4444',
  P2: '#f59e0b',
  P3: '#eab308',
  INFO: '#3b82f6',
};

interface Bucket {
  name: string;
  value: number;
}

export function AlertSeverityChart() {
  const [data, setData] = useState<Bucket[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: alerts } = await supabase.from('alerts').select('severity');
      if (!alerts) return;

      const counts: Record<string, number> = {};
      alerts.forEach((a) => {
        counts[a.severity] = (counts[a.severity] || 0) + 1;
      });

      const buckets = Object.entries(counts).map(([name, value]) => ({ name, value }));
      setData(buckets);
      setTotal(alerts.length);
    };
    load();
  }, []);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center h-[260px]">
        <p className="text-sm text-muted-foreground">No alert data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Alert Distribution
      </h3>
      <div className="flex items-center gap-4">
        <div className="w-[140px] h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 flex-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLORS[d.name] || '#6b7280' }}
                />
                <span className="font-mono font-semibold text-foreground">{d.name}</span>
              </div>
              <span className="text-muted-foreground font-mono">
                {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
          <div className="pt-1 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">Total</span>
            <span className="font-mono font-bold text-foreground">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
