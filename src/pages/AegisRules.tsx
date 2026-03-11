import { Layout } from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Shield, Plus, Pencil, Zap, Link as LinkIcon } from 'lucide-react';

interface DetectionRule {
  id: string;
  name: string;
  description: string | null;
  signal_type: string;
  severity: string;
  threshold_value: number | null;
  threshold_pct: number | null;
  window_seconds: number | null;
  min_occurrences: number | null;
  cooldown_seconds: number | null;
  is_active: boolean;
  created_at: string;
}

interface CorrelationPattern {
  id: string;
  name: string;
  description: string;
  severity: string;
  signals_required: unknown;
  min_signals_match: number | null;
  time_window_seconds: number | null;
  is_active: boolean;
  fire_count: number | null;
  true_positive_count: number | null;
}

const SEVERITIES = ['P1', 'P2', 'P3', 'INFO'];
const SIGNAL_TYPES = [
  'tvl_change', 'price_deviation', 'volume_spike', 'governance_change',
  'validator_delinquency', 'oracle_deviation', 'bridge_flow', 'rpc_latency',
  'slot_skip_rate', 'program_upgrade', 'authority_change', 'liquidity_drain',
];

export default function AegisRules() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [patterns, setPatterns] = useState<CorrelationPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rules' | 'patterns'>('rules');

  useEffect(() => {
    const load = async () => {
      const [rulesRes, patternsRes] = await Promise.all([
        supabase.from('detection_rules').select('*').order('created_at', { ascending: false }),
        supabase.from('correlation_patterns').select('*').order('created_at', { ascending: false }),
      ]);
      if (rulesRes.data) setRules(rulesRes.data as DetectionRule[]);
      if (patternsRes.data) setPatterns(patternsRes.data as CorrelationPattern[]);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Detection Rules</h1>
            <p className="text-xs text-muted-foreground font-mono tracking-wider">AEGIS RULE MANAGEMENT</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === 'rules' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('rules')}
            className="font-mono text-xs"
          >
            <Shield className="mr-1.5 h-3 w-3" />
            Detection Rules ({rules.length})
          </Button>
          <Button
            variant={tab === 'patterns' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('patterns')}
            className="font-mono text-xs"
          >
            <LinkIcon className="mr-1.5 h-3 w-3" />
            Correlation Patterns ({patterns.length})
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : tab === 'rules' ? (
          <RulesList rules={rules} />
        ) : (
          <PatternsList patterns={patterns} />
        )}
      </div>
    </Layout>
  );
}

function RulesList({ rules }: { rules: DetectionRule[] }) {
  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
        <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">No Detection Rules</h3>
        <p className="text-sm text-muted-foreground">Rules are configured via the detection engine.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={cn(
            'rounded-lg border bg-card p-4 transition-colors',
            rule.is_active ? 'border-border' : 'border-border/50 opacity-60',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
                <Badge variant="outline" className={cn(
                  'text-[10px] font-mono font-bold',
                  rule.severity === 'P1' && 'bg-red-500/20 text-red-400 border-red-500/30',
                  rule.severity === 'P2' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                  rule.severity === 'P3' && 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                  rule.severity === 'INFO' && 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                )}>
                  {rule.severity}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {rule.signal_type}
                </Badge>
              </div>
              {rule.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{rule.description}</p>
              )}
              <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground/60 font-mono">
                {rule.threshold_value != null && <span>threshold: {rule.threshold_value}</span>}
                {rule.threshold_pct != null && <span>pct: {rule.threshold_pct}%</span>}
                {rule.window_seconds != null && <span>window: {rule.window_seconds}s</span>}
                {rule.cooldown_seconds != null && <span>cooldown: {rule.cooldown_seconds}s</span>}
                {rule.min_occurrences != null && <span>min: {rule.min_occurrences}x</span>}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono shrink-0',
                rule.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border',
              )}
            >
              {rule.is_active ? 'ACTIVE' : 'DISABLED'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PatternsList({ patterns }: { patterns: CorrelationPattern[] }) {
  if (patterns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
        <LinkIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">No Correlation Patterns</h3>
        <p className="text-sm text-muted-foreground">Patterns define cross-signal anomaly detection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((p) => (
        <div
          key={p.id}
          className={cn(
            'rounded-lg border bg-card p-4',
            p.is_active ? 'border-border' : 'border-border/50 opacity-60',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                <Badge variant="outline" className={cn(
                  'text-[10px] font-mono font-bold',
                  p.severity === 'P1' && 'bg-red-500/20 text-red-400 border-red-500/30',
                  p.severity === 'P2' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                )}>
                  {p.severity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground/60 font-mono">
                <span>min match: {p.min_signals_match}</span>
                <span>window: {p.time_window_seconds}s</span>
                <span>fired: {p.fire_count || 0}x</span>
                <span>TP: {p.true_positive_count || 0}</span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono shrink-0',
                p.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border',
              )}
            >
              {p.is_active ? 'ACTIVE' : 'DISABLED'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
