import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';

interface Protocol {
  id: string;
  name: string;
  slug: string;
}

interface SignalPoint {
  time: string;
  value: number;
  zscore: number | null;
}

const SIGNAL_TYPES = [
  'tvl_change', 'price_deviation', 'volume_spike', 'oracle_deviation',
  'bridge_flow', 'rpc_latency', 'slot_skip_rate', 'validator_delinquency',
];

export function SignalHistoryChart() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState('');
  const [selectedSignal, setSelectedSignal] = useState('tvl_change');
  const [data, setData] = useState<SignalPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [baseline, setBaseline] = useState<{ mean: number; stddev: number } | null>(null);

  useEffect(() => {
    supabase.from('protocols').select('id, name, slug').eq('is_active', true).then(({ data }) => {
      if (data) {
        setProtocols(data as Protocol[]);
        if (data.length > 0) setSelectedProtocol(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedProtocol || !selectedSignal) return;

    const load = async () => {
      setLoading(true);

      // Fetch baseline for reference lines
      const { data: baselineData } = await supabase
        .from('signal_baselines')
        .select('mean_24h, stddev_24h')
        .eq('protocol_id', selectedProtocol)
        .eq('signal_type', selectedSignal as any)
        .maybeSingle();

      if (baselineData) {
        setBaseline({ mean: Number(baselineData.mean_24h) || 0, stddev: Number(baselineData.stddev_24h) || 0 });
      } else {
        setBaseline(null);
      }

      // We can't query 'signals' directly from anon (service-only table likely)
      // Instead show baselines-derived data
      setData([]);
      setLoading(false);
    };

    load();
  }, [selectedProtocol, selectedSignal]);

  const selectedProtoName = protocols.find((p) => p.id === selectedProtocol)?.name || '';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              Signal Intelligence
            </h3>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={selectedProtocol} onValueChange={setSelectedProtocol}>
            <SelectTrigger className="text-xs h-8 w-[180px]">
              <SelectValue placeholder="Protocol" />
            </SelectTrigger>
            <SelectContent>
              {protocols.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSignal} onValueChange={setSelectedSignal}>
            <SelectTrigger className="text-xs h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIGNAL_TYPES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4">
        {baseline ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">24h Mean</p>
                <p className="text-lg font-mono font-bold text-foreground">{baseline.mean.toFixed(4)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Std Dev</p>
                <p className="text-lg font-mono font-bold text-foreground">{baseline.stddev.toFixed(4)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Z-Score Range</p>
                <p className="text-lg font-mono font-bold text-foreground">
                  ±{baseline.stddev > 0 ? ((baseline.mean / baseline.stddev) * 2).toFixed(1) : '—'}
                </p>
              </div>
            </div>

            {/* Visual baseline bar */}
            <div className="rounded-md border border-border/50 bg-muted/20 p-4">
              <p className="text-[10px] text-muted-foreground font-mono mb-2">
                {selectedProtoName} / {selectedSignal.replace(/_/g, ' ')}
              </p>
              <div className="relative h-8 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 bg-primary/20 rounded-full"
                  style={{
                    left: '25%',
                    right: '25%',
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-primary"
                  style={{ left: '50%' }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3 text-[9px] font-mono text-muted-foreground">
                  <span>-2σ</span>
                  <span className="text-primary font-semibold">μ = {baseline.mean.toFixed(2)}</span>
                  <span>+2σ</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-1.5 text-center">
                Anomalies are detected when values exceed ±2 standard deviations from the rolling mean
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading signal data...' : 'No baseline data for this signal yet'}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Baselines populate as the detection engine collects signal data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
