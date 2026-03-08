import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useExplorerProjects, type ExplorerProject } from '@/hooks/useExplorerProjects';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Trophy, TrendingUp, Shield, Landmark, DollarSign, GitBranch,
  GitCommit, Users, Crown, ArrowUpRight, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ─── Category definitions ──────────────────────────────── */

interface SubMetric {
  key: string;
  label: string;
  icon: LucideIcon;
  getValue: (p: ExplorerProject) => number;
  format: (v: number) => string;
}

interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  subMetrics: SubMetric[];
}

const categories: Category[] = [
  {
    id: 'builders',
    label: 'Builders',
    icon: GitCommit,
    description: 'Most active development teams by commit velocity, output, and contributor growth',
    subMetrics: [
      { key: 'velocity', label: 'Commit Velocity', icon: TrendingUp, getValue: (p) => p.github_commit_velocity || 0, format: (v) => `${v.toFixed(1)}/wk` },
      { key: 'commits', label: 'Commits (30d)', icon: GitCommit, getValue: (p) => p.github_commits_30d || 0, format: (v) => v.toLocaleString() },
      { key: 'contributors', label: 'Contributors', icon: Users, getValue: (p) => p.github_contributors || 0, format: (v) => v.toLocaleString() },
    ],
  },
  {
    id: 'resilience',
    label: 'Resilience',
    icon: Shield,
    description: 'Highest overall resilience scores across all dimensions',
    subMetrics: [
      { key: 'resilience_score', label: 'Resilience Score', icon: Shield, getValue: (p) => Number(p.resilience_score) || 0, format: (v) => v.toFixed(1) },
      { key: 'integrated_score', label: 'Integrated Score', icon: Zap, getValue: (p) => Number(p.integrated_score) || 0, format: (v) => v.toFixed(1) },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    description: 'Best security posture by OpenSSF scorecard and lowest vulnerability counts',
    subMetrics: [
      { key: 'openssf', label: 'OpenSSF Score', icon: Shield, getValue: (p) => Number(p.openssf_score) || 0, format: (v) => v.toFixed(1) },
      { key: 'vuln', label: 'Least Vulnerabilities', icon: Shield, getValue: (p) => -(p.vulnerability_count || 0), format: (v) => Math.abs(v).toString() },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: Landmark,
    description: 'Most active on-chain governance with highest delivery rates',
    subMetrics: [
      { key: 'delivery', label: 'Delivery Rate', icon: Landmark, getValue: (p) => Number((p as any).realms_delivery_rate) || 0, format: (v) => `${(v * 100).toFixed(0)}%` },
      { key: 'gov_tx', label: 'Gov Txns (30d)', icon: Landmark, getValue: (p) => p.governance_tx_30d || 0, format: (v) => v.toLocaleString() },
    ],
  },
  {
    id: 'tvl',
    label: 'TVL',
    icon: DollarSign,
    description: 'Highest total value locked across DeFi protocols',
    subMetrics: [
      { key: 'tvl_usd', label: 'TVL (USD)', icon: DollarSign, getValue: (p) => Number(p.tvl_usd) || 0, format: (v) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${v.toLocaleString()}` },
    ],
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    icon: GitBranch,
    description: 'Healthiest supply chains with fewest outdated or critical dependencies',
    subMetrics: [
      { key: 'dep_health', label: 'Health Score', icon: GitBranch, getValue: (p) => p.dependency_health_score || 0, format: (v) => `${v}/100` },
    ],
  },
];

const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

/* ─── Ranked list component ─────────────────────────────── */

function RankedList({ projects, metric }: { projects: ExplorerProject[]; metric: SubMetric }) {
  const ranked = useMemo(() => {
    return [...projects]
      .filter((p) => metric.getValue(p) !== 0)
      .sort((a, b) => metric.getValue(b) - metric.getValue(a))
      .slice(0, 25);
  }, [projects, metric]);

  if (ranked.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data available for this metric yet.</p>;
  }

  const maxVal = Math.max(...ranked.map((p) => Math.abs(metric.getValue(p))));

  return (
    <div className="space-y-1">
      {ranked.map((project, i) => {
        const val = metric.getValue(project);
        const pct = maxVal > 0 ? (Math.abs(val) / maxVal) * 100 : 0;
        return (
          <Link
            key={project.id}
            to={`/profile/${project.id}`}
            className="group flex items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 transition-colors hover:border-primary/20 hover:bg-primary/5"
          >
            {/* Rank */}
            <span className={cn('w-7 text-right font-mono text-sm font-bold', i < 3 ? medalColors[i] : 'text-muted-foreground')}>
              {i < 3 ? <Crown className="inline h-4 w-4" /> : `#${i + 1}`}
            </span>

            {/* Logo */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted/30">
              {project.logo_url ? (
                <img src={project.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-xs text-muted-foreground">{project.program_name?.charAt(0)}</span>
              )}
            </div>

            {/* Name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {project.program_name}
                </span>
                {project.verified && <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/30 text-primary">VERIFIED</Badge>}
              </div>
              <Progress value={pct} className="mt-1 h-1.5 bg-muted/50 [&>div]:bg-primary/60" />
            </div>

            {/* Value */}
            <span className="shrink-0 font-mono text-sm font-medium text-primary">
              {metric.format(val)}
            </span>

            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */

export default function Leaderboard() {
  const { data: projects, isLoading } = useExplorerProjects();
  const [activeCategory, setActiveCategory] = useState('builders');
  const [activeSubMetric, setActiveSubMetric] = useState(0);

  const category = categories.find((c) => c.id === activeCategory)!;
  const metric = category.subMetrics[activeSubMetric];

  // Reset sub-metric when category changes
  const handleCategoryChange = (id: string) => {
    setActiveCategory(id);
    setActiveSubMetric(0);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Ecosystem Leaderboard
            </h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Who's topping Solana? Real-time rankings across development, security, governance, TVL, and supply-chain health — all derived from on-chain and off-chain signals.
          </p>
        </div>

        {/* Category tabs */}
        <Tabs value={activeCategory} onValueChange={handleCategoryChange}>
          <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-transparent p-0">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="flex items-center gap-1.5 rounded-sm border border-border bg-card/50 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Category description */}
        <p className="mb-4 text-sm text-muted-foreground">{category.description}</p>

        {/* Sub-metric toggles */}
        {category.subMetrics.length > 1 && (
          <div className="mb-4 flex gap-2">
            {category.subMetrics.map((sm, idx) => (
              <button
                key={sm.key}
                onClick={() => setActiveSubMetric(idx)}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-xs transition-colors',
                  idx === activeSubMetric
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-card/30 text-muted-foreground hover:text-foreground',
                )}
              >
                <sm.icon className="h-3 w-3" />
                {sm.label}
              </button>
            ))}
          </div>
        )}

        {/* Ranked list */}
        <div className="rounded-sm border border-border bg-card/30 p-2">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : projects ? (
            <RankedList projects={projects} metric={metric} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Failed to load data.</p>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Rankings update automatically as registry data refreshes. Only projects with non-zero metrics appear.
        </p>
      </div>
    </Layout>
  );
}
