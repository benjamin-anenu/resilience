import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LivenessStatus } from '@/types/database';

// Explorer project type - unified view from claimed_profiles
export interface ExplorerProject {
  id: string;
  program_id: string;
  program_name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  verified: boolean;
  github_org_url: string | null;
  github_last_commit: string | null;
  github_last_activity: string | null;
  resilience_score: number;
  liveness_status: LivenessStatus;
  is_fork: boolean;
  total_staked: number;
  // New fields for filtering
  category: string | null;
  country: string | null;
  // Claim status for unclaimed profiles
  claimStatus: 'claimed' | 'unclaimed' | 'pending';
  // Source tracking for routing
  isRegisteredProtocol: true;
  // Multi-dimensional health scores
  dependency_health_score: number;
  governance_tx_30d: number;
  tvl_usd: number;
  integrated_score: number;
  // Details toggle fields
  github_stars: number;
  github_contributors: number;
  x_username: string | null;
  github_analyzed_at: string | null;
  discovery_source: string | null;
  // Intelligence fields
  vulnerability_count: number | null;
  openssf_score: number | null;
  bytecode_match_status: string | null;
  github_commit_velocity: number;
  github_commits_30d: number;
  dependency_outdated_count: number;
  dependency_critical_count: number;
}

/**
 * Fetches verified registered protocols from claimed_profiles for the Explorer.
 * Includes real-time subscription to automatically refresh when profiles change.
 */
export function useExplorerProjects() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Set up real-time subscription to claimed_profiles changes with debouncing
  useEffect(() => {
    const channel = supabase
      .channel('explorer-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'claimed_profiles',
        },
        (payload) => {
          console.log('Explorer: Detected claimed_profiles change', payload.eventType);
          
          // Debounce: Only invalidate after 2 seconds of no changes
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['explorer-projects'] });
          }, 2000);
        }
      )
      .subscribe((status) => {
        console.log('Explorer realtime subscription:', status);
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['explorer-projects'],
    queryFn: async (): Promise<ExplorerProject[]> => {
      // Fetch both verified profiles AND unclaimed profiles
      const { data, error } = await (supabase
        .from('claimed_profiles_public' as any)
        .select('*')
        .or('verified.eq.true,claim_status.eq.unclaimed')
        .order('resilience_score', { ascending: false, nullsFirst: false }) as any);

      if (error) {
        console.error('Error fetching explorer projects:', error);
        throw error;
      }

      // Transform claimed_profiles to ExplorerProject format
      return (data || []).map((profile) => ({
        id: profile.id,
        program_id: profile.program_id || profile.id,
        program_name: profile.project_name,
        description: profile.description,
        website_url: profile.website_url,
        logo_url: profile.logo_url,
        verified: profile.verified,
        github_org_url: profile.github_org_url,
        github_last_commit: profile.github_last_commit,
        github_last_activity: profile.github_last_activity,
        resilience_score: profile.resilience_score || 0,
        liveness_status: (profile.liveness_status as LivenessStatus) || 'STALE',
        is_fork: profile.github_is_fork || false,
        total_staked: 0, // Phase 2 feature
        category: profile.category,
        country: (profile as { country?: string }).country || null,
        claimStatus: (profile.claim_status as 'claimed' | 'unclaimed' | 'pending') || 'claimed',
        isRegisteredProtocol: true as const,
        // Multi-dimensional health scores
        dependency_health_score: profile.dependency_health_score || 50,
        governance_tx_30d: profile.governance_tx_30d || 0,
        tvl_usd: profile.tvl_usd || 0,
        integrated_score: profile.integrated_score || 0,
        // Details toggle fields
        github_contributors: profile.github_contributors || 0,
        x_username: profile.x_username || null,
        github_analyzed_at: profile.github_analyzed_at || null,
        discovery_source: (profile as { discovery_source?: string }).discovery_source || null,
        // Intelligence fields
        vulnerability_count: profile.vulnerability_count ?? null,
        openssf_score: profile.openssf_score ?? null,
        bytecode_match_status: profile.bytecode_match_status ?? null,
        github_commit_velocity: profile.github_commit_velocity || 0,
        github_commits_30d: profile.github_commits_30d || 0,
        dependency_outdated_count: profile.dependency_outdated_count || 0,
        dependency_critical_count: profile.dependency_critical_count || 0,
      }));
    },
  });
}
