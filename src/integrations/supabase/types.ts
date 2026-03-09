export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_ai_usage: {
        Row: {
          conversation_id: string | null
          created_at: string
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          status_code: number | null
          tool_calls: Json | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          status_code?: number | null
          tool_calls?: Json | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          status_code?: number | null
          tool_calls?: Json | null
        }
        Relationships: []
      }
      admin_analytics: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_metadata: Json | null
          event_target: string
          event_type: string
          id: string
          session_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_metadata?: Json | null
          event_target: string
          event_type: string
          id?: string
          session_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_metadata?: Json | null
          event_target?: string
          event_type?: string
          id?: string
          session_id?: string
        }
        Relationships: []
      }
      admin_costs: {
        Row: {
          amount_usd: number
          category: string
          created_at: string
          id: string
          notes: string | null
          period: string
        }
        Insert: {
          amount_usd?: number
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          period: string
        }
        Update: {
          amount_usd?: number
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          period?: string
        }
        Relationships: []
      }
      admin_service_health: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          latency_ms: number | null
          service_name: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          service_name: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          service_name?: string
          status_code?: number | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      aegis_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      aegis_notification_log: {
        Row: {
          alert_id: string
          attempt_count: number | null
          channel: Database["public"]["Enums"]["notification_channel"]
          destination: string
          error_message: string | null
          id: string
          sent_at: string
          status: string
          subscriber_id: string | null
        }
        Insert: {
          alert_id: string
          attempt_count?: number | null
          channel: Database["public"]["Enums"]["notification_channel"]
          destination: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          subscriber_id?: string | null
        }
        Update: {
          alert_id?: string
          attempt_count?: number | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          destination?: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aegis_notification_log_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "aegis_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      aegis_protocol_subscriptions: {
        Row: {
          auto_detected: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          min_severity: Database["public"]["Enums"]["alert_severity"] | null
          protocol_id: string | null
          subscriber_id: string | null
          wallet_exposure: Json | null
        }
        Insert: {
          auto_detected?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_severity?: Database["public"]["Enums"]["alert_severity"] | null
          protocol_id?: string | null
          subscriber_id?: string | null
          wallet_exposure?: Json | null
        }
        Update: {
          auto_detected?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_severity?: Database["public"]["Enums"]["alert_severity"] | null
          protocol_id?: string | null
          subscriber_id?: string | null
          wallet_exposure?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "aegis_protocol_subscriptions_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aegis_protocol_subscriptions_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aegis_protocol_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "aegis_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      aegis_subscribers: {
        Row: {
          created_at: string | null
          digest_mode: boolean | null
          email: string | null
          global_min_severity:
            | Database["public"]["Enums"]["alert_severity"]
            | null
          id: string
          is_active: boolean | null
          nickname: string | null
          updated_at: string | null
          wallet_address: string | null
          wallet_last_scanned_at: string | null
          x_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          digest_mode?: boolean | null
          email?: string | null
          global_min_severity?:
            | Database["public"]["Enums"]["alert_severity"]
            | null
          id?: string
          is_active?: boolean | null
          nickname?: string | null
          updated_at?: string | null
          wallet_address?: string | null
          wallet_last_scanned_at?: string | null
          x_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          digest_mode?: boolean | null
          email?: string | null
          global_min_severity?:
            | Database["public"]["Enums"]["alert_severity"]
            | null
          id?: string
          is_active?: boolean | null
          nickname?: string | null
          updated_at?: string | null
          wallet_address?: string | null
          wallet_last_scanned_at?: string | null
          x_user_id?: string | null
        }
        Relationships: []
      }
      aegis_subscription_channels: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          config: Json | null
          created_at: string | null
          destination: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          min_severity: Database["public"]["Enums"]["alert_severity"] | null
          subscriber_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          config?: Json | null
          created_at?: string | null
          destination: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          min_severity?: Database["public"]["Enums"]["alert_severity"] | null
          subscriber_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          config?: Json | null
          created_at?: string | null
          destination?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          min_severity?: Database["public"]["Enums"]["alert_severity"] | null
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aegis_subscription_channels_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "aegis_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      aegis_system_health: {
        Row: {
          component: string
          error_message: string | null
          id: string
          last_run_at: string | null
          last_success_at: string | null
          metrics: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          component: string
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          last_success_at?: string | null
          metrics?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          component?: string
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          last_success_at?: string | null
          metrics?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      alert_dedup: {
        Row: {
          alert_id: string
          created_at: string | null
          dedup_key: string
          expires_at: string
        }
        Insert: {
          alert_id: string
          created_at?: string | null
          dedup_key: string
          expires_at: string
        }
        Update: {
          alert_id?: string
          created_at?: string | null
          dedup_key?: string
          expires_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          affected_protocols: string[] | null
          description: string
          fired_at: string
          id: string
          onchain_signature: string | null
          pattern_id: string | null
          protocol_id: string | null
          resolved_at: string | null
          rule_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          signal_snapshot: Json
          status: Database["public"]["Enums"]["alert_status"] | null
          subscriber_count: number | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_protocols?: string[] | null
          description: string
          fired_at?: string
          id?: string
          onchain_signature?: string | null
          pattern_id?: string | null
          protocol_id?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          signal_snapshot: Json
          status?: Database["public"]["Enums"]["alert_status"] | null
          subscriber_count?: number | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_protocols?: string[] | null
          description?: string
          fired_at?: string
          id?: string
          onchain_signature?: string | null
          pattern_id?: string | null
          protocol_id?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          signal_snapshot?: Json
          status?: Database["public"]["Enums"]["alert_status"] | null
          subscriber_count?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "correlation_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "detection_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      bonds: {
        Row: {
          created_at: string
          id: string
          locked_until: string
          project_id: string
          staked_amount: number
          user_wallet: string
          yield_earned: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          locked_until: string
          project_id: string
          staked_amount: number
          user_wallet: string
          yield_earned?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          locked_until?: string
          project_id?: string
          staked_amount?: number
          user_wallet?: string
          yield_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bonds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bounties: {
        Row: {
          claimed_at: string | null
          claimer_profile_id: string | null
          claimer_wallet: string | null
          claimer_x_user_id: string | null
          created_at: string
          creator_profile_id: string
          creator_x_user_id: string
          description: string | null
          escrow_address: string | null
          escrow_tx_signature: string | null
          evidence_links: Json | null
          evidence_summary: string | null
          funded_at: string | null
          governance_pda: string | null
          id: string
          linked_milestone_id: string | null
          milestones: Json
          paid_at: string | null
          proposal_address: string | null
          realm_dao_address: string
          release_mode: string
          release_tx_signature: string | null
          resolved_at: string | null
          reward_sol: number
          status: string
          submitted_at: string | null
          title: string
        }
        Insert: {
          claimed_at?: string | null
          claimer_profile_id?: string | null
          claimer_wallet?: string | null
          claimer_x_user_id?: string | null
          created_at?: string
          creator_profile_id: string
          creator_x_user_id: string
          description?: string | null
          escrow_address?: string | null
          escrow_tx_signature?: string | null
          evidence_links?: Json | null
          evidence_summary?: string | null
          funded_at?: string | null
          governance_pda?: string | null
          id?: string
          linked_milestone_id?: string | null
          milestones?: Json
          paid_at?: string | null
          proposal_address?: string | null
          realm_dao_address: string
          release_mode?: string
          release_tx_signature?: string | null
          resolved_at?: string | null
          reward_sol?: number
          status?: string
          submitted_at?: string | null
          title: string
        }
        Update: {
          claimed_at?: string | null
          claimer_profile_id?: string | null
          claimer_wallet?: string | null
          claimer_x_user_id?: string | null
          created_at?: string
          creator_profile_id?: string
          creator_x_user_id?: string
          description?: string | null
          escrow_address?: string | null
          escrow_tx_signature?: string | null
          evidence_links?: Json | null
          evidence_summary?: string | null
          funded_at?: string | null
          governance_pda?: string | null
          id?: string
          linked_milestone_id?: string | null
          milestones?: Json
          paid_at?: string | null
          proposal_address?: string | null
          realm_dao_address?: string
          release_mode?: string
          release_tx_signature?: string | null
          resolved_at?: string | null
          reward_sol?: number
          status?: string
          submitted_at?: string | null
          title?: string
        }
        Relationships: []
      }
      bounty_waitlist: {
        Row: {
          created_at: string
          email: string | null
          id: string
          wallet_address: string | null
          x_user_id: string | null
          x_username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          wallet_address?: string | null
          x_user_id?: string | null
          x_username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          wallet_address?: string | null
          x_user_id?: string | null
          x_username?: string | null
        }
        Relationships: []
      }
      canary_consensus: {
        Row: {
          alert_triggered: boolean | null
          avg_latency_ms: number | null
          consensus_reached: boolean | null
          created_at: string | null
          failure_count: number
          failure_rate: number
          id: string
          probe_name: string
          protocol_id: string | null
          total_reports: number
          window_end: string
          window_start: string
        }
        Insert: {
          alert_triggered?: boolean | null
          avg_latency_ms?: number | null
          consensus_reached?: boolean | null
          created_at?: string | null
          failure_count: number
          failure_rate: number
          id?: string
          probe_name: string
          protocol_id?: string | null
          total_reports: number
          window_end: string
          window_start: string
        }
        Update: {
          alert_triggered?: boolean | null
          avg_latency_ms?: number | null
          consensus_reached?: boolean | null
          created_at?: string | null
          failure_count?: number
          failure_rate?: number
          id?: string
          probe_name?: string
          protocol_id?: string | null
          total_reports?: number
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "canary_consensus_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canary_consensus_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
        ]
      }
      canary_nodes: {
        Row: {
          accurate_reports: number | null
          api_key_hash: string
          banned_reason: string | null
          false_reports: number | null
          geographic_region: string | null
          id: string
          last_seen_at: string | null
          metadata: Json | null
          node_id: string
          registered_at: string | null
          reputation_score: number | null
          status: Database["public"]["Enums"]["canary_status"] | null
          total_reports: number | null
          version: string | null
          wallet_address: string
        }
        Insert: {
          accurate_reports?: number | null
          api_key_hash: string
          banned_reason?: string | null
          false_reports?: number | null
          geographic_region?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          node_id: string
          registered_at?: string | null
          reputation_score?: number | null
          status?: Database["public"]["Enums"]["canary_status"] | null
          total_reports?: number | null
          version?: string | null
          wallet_address: string
        }
        Update: {
          accurate_reports?: number | null
          api_key_hash?: string
          banned_reason?: string | null
          false_reports?: number | null
          geographic_region?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          node_id?: string
          registered_at?: string | null
          reputation_score?: number | null
          status?: Database["public"]["Enums"]["canary_status"] | null
          total_reports?: number | null
          version?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      canary_reports: {
        Row: {
          canary_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          probe_name: string
          protocol_id: string | null
          raw_result: Json | null
          reported_at: string
          signature: string
          success: boolean
        }
        Insert: {
          canary_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          probe_name: string
          protocol_id?: string | null
          raw_result?: Json | null
          reported_at?: string
          signature: string
          success: boolean
        }
        Update: {
          canary_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          probe_name?: string
          protocol_id?: string | null
          raw_result?: Json | null
          reported_at?: string
          signature?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "canary_reports_canary_id_fkey"
            columns: ["canary_id"]
            isOneToOne: false
            referencedRelation: "canary_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canary_reports_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canary_reports_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_blacklist: {
        Row: {
          attempt_count: number
          created_at: string
          first_attempt_at: string
          id: string
          is_permanent_ban: boolean
          last_attempt_at: string
          profile_id: string
          wallet_address: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          is_permanent_ban?: boolean
          last_attempt_at?: string
          profile_id: string
          wallet_address: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          is_permanent_ban?: boolean
          last_attempt_at?: string
          profile_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_blacklist_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_blacklist_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      claimed_profiles: {
        Row: {
          authority_signature: string | null
          authority_type: string | null
          authority_verified_at: string | null
          authority_wallet: string | null
          build_in_public_videos: Json | null
          bytecode_confidence: string | null
          bytecode_deploy_slot: number | null
          bytecode_hash: string | null
          bytecode_match_status: string | null
          bytecode_on_chain_hash: string | null
          bytecode_verified_at: string | null
          category: string | null
          claim_status: string | null
          claimer_wallet: string | null
          country: string | null
          created_at: string
          dependency_analyzed_at: string | null
          dependency_critical_count: number | null
          dependency_health_score: number | null
          dependency_outdated_count: number | null
          description: string | null
          discord_url: string | null
          discovered_at: string | null
          discovery_source: string | null
          funding_requested_sol: number | null
          funding_status: string | null
          github_access_token: string | null
          github_analyzed_at: string | null
          github_commit_velocity: number | null
          github_commits_30d: number | null
          github_contributors: number | null
          github_forks: number | null
          github_homepage: string | null
          github_is_fork: boolean | null
          github_issue_events_30d: number | null
          github_language: string | null
          github_languages: Json | null
          github_last_activity: string | null
          github_last_commit: string | null
          github_open_issues: number | null
          github_org_url: string | null
          github_pr_events_30d: number | null
          github_push_events_30d: number | null
          github_recent_events: Json | null
          github_releases_30d: number | null
          github_stars: number | null
          github_token_scope: string | null
          github_top_contributors: Json | null
          github_topics: Json | null
          github_username: string | null
          governance_address: string | null
          governance_analyzed_at: string | null
          governance_last_activity: string | null
          governance_tx_30d: number | null
          id: string
          integrated_score: number | null
          liveness_status: string | null
          logo_url: string | null
          media_assets: Json | null
          milestones: Json | null
          multisig_address: string | null
          multisig_verified_via: string | null
          openssf_analyzed_at: string | null
          openssf_checks: Json | null
          openssf_score: number | null
          program_id: string | null
          project_id: string | null
          project_name: string
          realms_analyzed_at: string | null
          realms_dao_address: string | null
          realms_delivery_rate: number | null
          realms_last_proposal: string | null
          realms_proposals_active: number | null
          realms_proposals_completed: number | null
          realms_proposals_total: number | null
          realms_raw_data: Json | null
          resilience_score: number | null
          score_breakdown: Json | null
          squads_version: string | null
          staking_pitch: string | null
          team_members: Json | null
          telegram_url: string | null
          tvl_analyzed_at: string | null
          tvl_market_share: number | null
          tvl_risk_ratio: number | null
          tvl_usd: number | null
          twitter_engagement_rate: number | null
          twitter_followers: number | null
          twitter_last_synced: string | null
          twitter_recent_tweets: Json | null
          updated_at: string
          verified: boolean
          verified_at: string | null
          vulnerability_analyzed_at: string | null
          vulnerability_count: number | null
          vulnerability_details: Json | null
          wallet_address: string | null
          website_url: string | null
          x_avatar_url: string | null
          x_display_name: string | null
          x_user_id: string | null
          x_username: string | null
        }
        Insert: {
          authority_signature?: string | null
          authority_type?: string | null
          authority_verified_at?: string | null
          authority_wallet?: string | null
          build_in_public_videos?: Json | null
          bytecode_confidence?: string | null
          bytecode_deploy_slot?: number | null
          bytecode_hash?: string | null
          bytecode_match_status?: string | null
          bytecode_on_chain_hash?: string | null
          bytecode_verified_at?: string | null
          category?: string | null
          claim_status?: string | null
          claimer_wallet?: string | null
          country?: string | null
          created_at?: string
          dependency_analyzed_at?: string | null
          dependency_critical_count?: number | null
          dependency_health_score?: number | null
          dependency_outdated_count?: number | null
          description?: string | null
          discord_url?: string | null
          discovered_at?: string | null
          discovery_source?: string | null
          funding_requested_sol?: number | null
          funding_status?: string | null
          github_access_token?: string | null
          github_analyzed_at?: string | null
          github_commit_velocity?: number | null
          github_commits_30d?: number | null
          github_contributors?: number | null
          github_forks?: number | null
          github_homepage?: string | null
          github_is_fork?: boolean | null
          github_issue_events_30d?: number | null
          github_language?: string | null
          github_languages?: Json | null
          github_last_activity?: string | null
          github_last_commit?: string | null
          github_open_issues?: number | null
          github_org_url?: string | null
          github_pr_events_30d?: number | null
          github_push_events_30d?: number | null
          github_recent_events?: Json | null
          github_releases_30d?: number | null
          github_stars?: number | null
          github_token_scope?: string | null
          github_top_contributors?: Json | null
          github_topics?: Json | null
          github_username?: string | null
          governance_address?: string | null
          governance_analyzed_at?: string | null
          governance_last_activity?: string | null
          governance_tx_30d?: number | null
          id?: string
          integrated_score?: number | null
          liveness_status?: string | null
          logo_url?: string | null
          media_assets?: Json | null
          milestones?: Json | null
          multisig_address?: string | null
          multisig_verified_via?: string | null
          openssf_analyzed_at?: string | null
          openssf_checks?: Json | null
          openssf_score?: number | null
          program_id?: string | null
          project_id?: string | null
          project_name: string
          realms_analyzed_at?: string | null
          realms_dao_address?: string | null
          realms_delivery_rate?: number | null
          realms_last_proposal?: string | null
          realms_proposals_active?: number | null
          realms_proposals_completed?: number | null
          realms_proposals_total?: number | null
          realms_raw_data?: Json | null
          resilience_score?: number | null
          score_breakdown?: Json | null
          squads_version?: string | null
          staking_pitch?: string | null
          team_members?: Json | null
          telegram_url?: string | null
          tvl_analyzed_at?: string | null
          tvl_market_share?: number | null
          tvl_risk_ratio?: number | null
          tvl_usd?: number | null
          twitter_engagement_rate?: number | null
          twitter_followers?: number | null
          twitter_last_synced?: string | null
          twitter_recent_tweets?: Json | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          vulnerability_analyzed_at?: string | null
          vulnerability_count?: number | null
          vulnerability_details?: Json | null
          wallet_address?: string | null
          website_url?: string | null
          x_avatar_url?: string | null
          x_display_name?: string | null
          x_user_id?: string | null
          x_username?: string | null
        }
        Update: {
          authority_signature?: string | null
          authority_type?: string | null
          authority_verified_at?: string | null
          authority_wallet?: string | null
          build_in_public_videos?: Json | null
          bytecode_confidence?: string | null
          bytecode_deploy_slot?: number | null
          bytecode_hash?: string | null
          bytecode_match_status?: string | null
          bytecode_on_chain_hash?: string | null
          bytecode_verified_at?: string | null
          category?: string | null
          claim_status?: string | null
          claimer_wallet?: string | null
          country?: string | null
          created_at?: string
          dependency_analyzed_at?: string | null
          dependency_critical_count?: number | null
          dependency_health_score?: number | null
          dependency_outdated_count?: number | null
          description?: string | null
          discord_url?: string | null
          discovered_at?: string | null
          discovery_source?: string | null
          funding_requested_sol?: number | null
          funding_status?: string | null
          github_access_token?: string | null
          github_analyzed_at?: string | null
          github_commit_velocity?: number | null
          github_commits_30d?: number | null
          github_contributors?: number | null
          github_forks?: number | null
          github_homepage?: string | null
          github_is_fork?: boolean | null
          github_issue_events_30d?: number | null
          github_language?: string | null
          github_languages?: Json | null
          github_last_activity?: string | null
          github_last_commit?: string | null
          github_open_issues?: number | null
          github_org_url?: string | null
          github_pr_events_30d?: number | null
          github_push_events_30d?: number | null
          github_recent_events?: Json | null
          github_releases_30d?: number | null
          github_stars?: number | null
          github_token_scope?: string | null
          github_top_contributors?: Json | null
          github_topics?: Json | null
          github_username?: string | null
          governance_address?: string | null
          governance_analyzed_at?: string | null
          governance_last_activity?: string | null
          governance_tx_30d?: number | null
          id?: string
          integrated_score?: number | null
          liveness_status?: string | null
          logo_url?: string | null
          media_assets?: Json | null
          milestones?: Json | null
          multisig_address?: string | null
          multisig_verified_via?: string | null
          openssf_analyzed_at?: string | null
          openssf_checks?: Json | null
          openssf_score?: number | null
          program_id?: string | null
          project_id?: string | null
          project_name?: string
          realms_analyzed_at?: string | null
          realms_dao_address?: string | null
          realms_delivery_rate?: number | null
          realms_last_proposal?: string | null
          realms_proposals_active?: number | null
          realms_proposals_completed?: number | null
          realms_proposals_total?: number | null
          realms_raw_data?: Json | null
          resilience_score?: number | null
          score_breakdown?: Json | null
          squads_version?: string | null
          staking_pitch?: string | null
          team_members?: Json | null
          telegram_url?: string | null
          tvl_analyzed_at?: string | null
          tvl_market_share?: number | null
          tvl_risk_ratio?: number | null
          tvl_usd?: number | null
          twitter_engagement_rate?: number | null
          twitter_followers?: number | null
          twitter_last_synced?: string | null
          twitter_recent_tweets?: Json | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          vulnerability_analyzed_at?: string | null
          vulnerability_count?: number | null
          vulnerability_details?: Json | null
          wallet_address?: string | null
          website_url?: string | null
          x_avatar_url?: string | null
          x_display_name?: string | null
          x_user_id?: string | null
          x_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claimed_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      correlation_patterns: {
        Row: {
          created_at: string | null
          description: string
          fire_count: number | null
          id: string
          is_active: boolean | null
          min_signals_match: number | null
          name: string
          severity: Database["public"]["Enums"]["alert_severity"]
          signals_required: Json
          time_window_seconds: number | null
          true_positive_count: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          fire_count?: number | null
          id?: string
          is_active?: boolean | null
          min_signals_match?: number | null
          name: string
          severity: Database["public"]["Enums"]["alert_severity"]
          signals_required: Json
          time_window_seconds?: number | null
          true_positive_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          fire_count?: number | null
          id?: string
          is_active?: boolean | null
          min_signals_match?: number | null
          name?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          signals_required?: Json
          time_window_seconds?: number | null
          true_positive_count?: number | null
        }
        Relationships: []
      }
      dependency_graph: {
        Row: {
          analyzed_at: string | null
          crate_name: string
          crates_io_dependents: number | null
          crates_io_url: string | null
          current_version: string | null
          dependency_type: string | null
          id: string
          is_critical: boolean | null
          is_outdated: boolean | null
          latest_version: string | null
          months_behind: number | null
          npm_url: string | null
          package_name: string | null
          pypi_url: string | null
          source_profile_id: string
        }
        Insert: {
          analyzed_at?: string | null
          crate_name: string
          crates_io_dependents?: number | null
          crates_io_url?: string | null
          current_version?: string | null
          dependency_type?: string | null
          id?: string
          is_critical?: boolean | null
          is_outdated?: boolean | null
          latest_version?: string | null
          months_behind?: number | null
          npm_url?: string | null
          package_name?: string | null
          pypi_url?: string | null
          source_profile_id: string
        }
        Update: {
          analyzed_at?: string | null
          crate_name?: string
          crates_io_dependents?: number | null
          crates_io_url?: string | null
          current_version?: string | null
          dependency_type?: string | null
          id?: string
          is_critical?: boolean | null
          is_outdated?: boolean | null
          latest_version?: string | null
          months_behind?: number | null
          npm_url?: string | null
          package_name?: string | null
          pypi_url?: string | null
          source_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependency_graph_source_profile_id_fkey"
            columns: ["source_profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependency_graph_source_profile_id_fkey"
            columns: ["source_profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      detection_rules: {
        Row: {
          category: Database["public"]["Enums"]["protocol_category"] | null
          cooldown_seconds: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          min_occurrences: number | null
          name: string
          protocol_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          signal_type: Database["public"]["Enums"]["signal_type"]
          threshold_pct: number | null
          threshold_value: number | null
          updated_at: string | null
          window_seconds: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["protocol_category"] | null
          cooldown_seconds?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_occurrences?: number | null
          name: string
          protocol_id?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          signal_type: Database["public"]["Enums"]["signal_type"]
          threshold_pct?: number | null
          threshold_value?: number | null
          updated_at?: string | null
          window_seconds?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["protocol_category"] | null
          cooldown_seconds?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_occurrences?: number | null
          name?: string
          protocol_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          signal_type?: Database["public"]["Enums"]["signal_type"]
          threshold_pct?: number | null
          threshold_value?: number | null
          updated_at?: string | null
          window_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "detection_rules_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detection_rules_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_snapshots: {
        Row: {
          active_projects: number
          avg_dependency_health: number
          avg_resilience_score: number
          created_at: string | null
          decaying_count: number
          healthy_count: number
          id: string
          snapshot_date: string
          stale_count: number
          total_commits_30d: number
          total_contributors: number
          total_governance_tx: number
          total_projects: number
          total_tvl_usd: number
        }
        Insert: {
          active_projects?: number
          avg_dependency_health?: number
          avg_resilience_score?: number
          created_at?: string | null
          decaying_count?: number
          healthy_count?: number
          id?: string
          snapshot_date: string
          stale_count?: number
          total_commits_30d?: number
          total_contributors?: number
          total_governance_tx?: number
          total_projects?: number
          total_tvl_usd?: number
        }
        Update: {
          active_projects?: number
          avg_dependency_health?: number
          avg_resilience_score?: number
          created_at?: string | null
          decaying_count?: number
          healthy_count?: number
          id?: string
          snapshot_date?: string
          stale_count?: number
          total_commits_30d?: number
          total_contributors?: number
          total_governance_tx?: number
          total_projects?: number
          total_tvl_usd?: number
        }
        Relationships: []
      }
      ecosystem_trends: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_type: string
          expires_at: string | null
          id: string
          metadata: Json | null
          priority: string
          profile_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_type: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          profile_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_type?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          profile_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_trends_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_trends_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_proposals: {
        Row: {
          created_at: string
          escrow_address: string | null
          funded_at: string | null
          id: string
          milestone_allocations: Json
          profile_id: string
          proposal_address: string | null
          proposal_tx: string | null
          realm_dao_address: string
          requested_sol: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escrow_address?: string | null
          funded_at?: string | null
          id?: string
          milestone_allocations?: Json
          profile_id: string
          proposal_address?: string | null
          proposal_tx?: string | null
          realm_dao_address: string
          requested_sol?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escrow_address?: string | null
          funded_at?: string | null
          id?: string
          milestone_allocations?: Json
          profile_id?: string
          proposal_address?: string | null
          proposal_tx?: string | null
          realm_dao_address?: string
          requested_sol?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_proposals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_proposals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          bounty_id: string | null
          created_at: string
          id: string
          profile_id: string | null
          read: boolean
          recipient_x_user_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          bounty_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          read?: boolean
          recipient_x_user_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          bounty_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          read?: boolean
          recipient_x_user_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      profile_secrets: {
        Row: {
          created_at: string
          github_access_token: string | null
          github_token_scope: string | null
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          github_access_token?: string | null
          github_token_scope?: string | null
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          github_access_token?: string | null
          github_token_scope?: string | null
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_secrets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_secrets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      project_subscribers: {
        Row: {
          email: string
          id: string
          profile_id: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          profile_id: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          profile_id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_subscribers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_subscribers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          github_commit_velocity: number | null
          github_contributors: number | null
          github_forks: number | null
          github_language: string | null
          github_last_commit: string | null
          github_stars: number | null
          github_url: string | null
          id: string
          is_fork: boolean | null
          is_multisig: boolean | null
          last_onchain_activity: string | null
          liveness_status: Database["public"]["Enums"]["liveness_status"] | null
          logo_url: string | null
          originality_score: number | null
          program_authority: string | null
          program_id: string
          program_name: string
          resilience_score: number | null
          total_staked: number | null
          updated_at: string
          verified: boolean
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          github_commit_velocity?: number | null
          github_contributors?: number | null
          github_forks?: number | null
          github_language?: string | null
          github_last_commit?: string | null
          github_stars?: number | null
          github_url?: string | null
          id?: string
          is_fork?: boolean | null
          is_multisig?: boolean | null
          last_onchain_activity?: string | null
          liveness_status?:
            | Database["public"]["Enums"]["liveness_status"]
            | null
          logo_url?: string | null
          originality_score?: number | null
          program_authority?: string | null
          program_id: string
          program_name: string
          resilience_score?: number | null
          total_staked?: number | null
          updated_at?: string
          verified?: boolean
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          github_commit_velocity?: number | null
          github_contributors?: number | null
          github_forks?: number | null
          github_language?: string | null
          github_last_commit?: string | null
          github_stars?: number | null
          github_url?: string | null
          id?: string
          is_fork?: boolean | null
          is_multisig?: boolean | null
          last_onchain_activity?: string | null
          liveness_status?:
            | Database["public"]["Enums"]["liveness_status"]
            | null
          logo_url?: string | null
          originality_score?: number | null
          program_authority?: string | null
          program_id?: string
          program_name?: string
          resilience_score?: number | null
          total_staked?: number | null
          updated_at?: string
          verified?: boolean
          website_url?: string | null
        }
        Relationships: []
      }
      protocols: {
        Row: {
          category: Database["public"]["Enums"]["protocol_category"]
          created_at: string | null
          defillama_slug: string | null
          helius_filters: Json | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          monitoring_config: Json | null
          name: string
          program_address: string | null
          slug: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["protocol_category"]
          created_at?: string | null
          defillama_slug?: string | null
          helius_filters?: Json | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monitoring_config?: Json | null
          name: string
          program_address?: string | null
          slug: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["protocol_category"]
          created_at?: string | null
          defillama_slug?: string | null
          helius_filters?: Json | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monitoring_config?: Json | null
          name?: string
          program_address?: string | null
          slug?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      score_history: {
        Row: {
          breakdown: Json | null
          claimed_profile_id: string | null
          commit_velocity: number | null
          days_last_commit: number | null
          id: string
          project_id: string | null
          score: number
          snapshot_date: string
          snapshot_day: string | null
        }
        Insert: {
          breakdown?: Json | null
          claimed_profile_id?: string | null
          commit_velocity?: number | null
          days_last_commit?: number | null
          id?: string
          project_id?: string | null
          score: number
          snapshot_date?: string
          snapshot_day?: string | null
        }
        Update: {
          breakdown?: Json | null
          claimed_profile_id?: string | null
          commit_velocity?: number | null
          days_last_commit?: number | null
          id?: string
          project_id?: string | null
          score?: number
          snapshot_date?: string
          snapshot_day?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_history_claimed_profile_id_fkey"
            columns: ["claimed_profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_claimed_profile_id_fkey"
            columns: ["claimed_profile_id"]
            isOneToOne: false
            referencedRelation: "claimed_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_baselines: {
        Row: {
          id: string
          last_updated: string | null
          mean_1h: number | null
          mean_24h: number | null
          mean_7d: number | null
          protocol_id: string | null
          sample_count: number | null
          signal_type: Database["public"]["Enums"]["signal_type"]
          stddev_1h: number | null
          stddev_24h: number | null
          stddev_7d: number | null
        }
        Insert: {
          id?: string
          last_updated?: string | null
          mean_1h?: number | null
          mean_24h?: number | null
          mean_7d?: number | null
          protocol_id?: string | null
          sample_count?: number | null
          signal_type: Database["public"]["Enums"]["signal_type"]
          stddev_1h?: number | null
          stddev_24h?: number | null
          stddev_7d?: number | null
        }
        Update: {
          id?: string
          last_updated?: string | null
          mean_1h?: number | null
          mean_24h?: number | null
          mean_7d?: number | null
          protocol_id?: string | null
          sample_count?: number | null
          signal_type?: Database["public"]["Enums"]["signal_type"]
          stddev_1h?: number | null
          stddev_24h?: number | null
          stddev_7d?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_baselines_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_baselines_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          baseline: number | null
          id: string
          metadata: Json | null
          protocol_id: string | null
          recorded_at: string
          signal_type: Database["public"]["Enums"]["signal_type"]
          source: string
          value: number
          zscore: number | null
        }
        Insert: {
          baseline?: number | null
          id?: string
          metadata?: Json | null
          protocol_id?: string | null
          recorded_at?: string
          signal_type: Database["public"]["Enums"]["signal_type"]
          source: string
          value: number
          zscore?: number | null
        }
        Update: {
          baseline?: number | null
          id?: string
          metadata?: Json | null
          protocol_id?: string | null
          recorded_at?: string
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source?: string
          value?: number
          zscore?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "v_protocol_health"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bonds_public: {
        Row: {
          created_at: string | null
          id: string | null
          locked_until: string | null
          project_id: string | null
          staked_amount: number | null
          yield_earned: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          locked_until?: string | null
          project_id?: string | null
          staked_amount?: number | null
          yield_earned?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          locked_until?: string | null
          project_id?: string | null
          staked_amount?: number | null
          yield_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bonds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      claimed_profiles_public: {
        Row: {
          build_in_public_videos: Json | null
          bytecode_confidence: string | null
          bytecode_deploy_slot: number | null
          bytecode_hash: string | null
          bytecode_match_status: string | null
          bytecode_on_chain_hash: string | null
          bytecode_verified_at: string | null
          category: string | null
          claim_status: string | null
          country: string | null
          created_at: string | null
          dependency_analyzed_at: string | null
          dependency_critical_count: number | null
          dependency_health_score: number | null
          dependency_outdated_count: number | null
          description: string | null
          discord_url: string | null
          discovery_source: string | null
          funding_requested_sol: number | null
          funding_status: string | null
          github_analyzed_at: string | null
          github_commit_velocity: number | null
          github_commits_30d: number | null
          github_contributors: number | null
          github_forks: number | null
          github_homepage: string | null
          github_is_fork: boolean | null
          github_issue_events_30d: number | null
          github_language: string | null
          github_languages: Json | null
          github_last_activity: string | null
          github_last_commit: string | null
          github_open_issues: number | null
          github_org_url: string | null
          github_pr_events_30d: number | null
          github_push_events_30d: number | null
          github_recent_events: Json | null
          github_releases_30d: number | null
          github_stars: number | null
          github_top_contributors: Json | null
          github_topics: Json | null
          github_username: string | null
          governance_address: string | null
          governance_analyzed_at: string | null
          governance_last_activity: string | null
          governance_tx_30d: number | null
          id: string | null
          integrated_score: number | null
          liveness_status: string | null
          logo_url: string | null
          media_assets: Json | null
          milestones: Json | null
          openssf_analyzed_at: string | null
          openssf_checks: Json | null
          openssf_score: number | null
          program_id: string | null
          project_id: string | null
          project_name: string | null
          realms_analyzed_at: string | null
          realms_dao_address: string | null
          realms_delivery_rate: number | null
          realms_last_proposal: string | null
          realms_proposals_active: number | null
          realms_proposals_completed: number | null
          realms_proposals_total: number | null
          resilience_score: number | null
          score_breakdown: Json | null
          staking_pitch: string | null
          team_members: Json | null
          telegram_url: string | null
          tvl_analyzed_at: string | null
          tvl_market_share: number | null
          tvl_risk_ratio: number | null
          tvl_usd: number | null
          twitter_engagement_rate: number | null
          twitter_followers: number | null
          twitter_last_synced: string | null
          twitter_recent_tweets: Json | null
          updated_at: string | null
          verified: boolean | null
          verified_at: string | null
          vulnerability_analyzed_at: string | null
          vulnerability_count: number | null
          vulnerability_details: Json | null
          website_url: string | null
          x_avatar_url: string | null
          x_display_name: string | null
          x_user_id: string | null
          x_username: string | null
        }
        Insert: {
          build_in_public_videos?: Json | null
          bytecode_confidence?: string | null
          bytecode_deploy_slot?: number | null
          bytecode_hash?: string | null
          bytecode_match_status?: string | null
          bytecode_on_chain_hash?: string | null
          bytecode_verified_at?: string | null
          category?: string | null
          claim_status?: string | null
          country?: string | null
          created_at?: string | null
          dependency_analyzed_at?: string | null
          dependency_critical_count?: number | null
          dependency_health_score?: number | null
          dependency_outdated_count?: number | null
          description?: string | null
          discord_url?: string | null
          discovery_source?: string | null
          funding_requested_sol?: number | null
          funding_status?: string | null
          github_analyzed_at?: string | null
          github_commit_velocity?: number | null
          github_commits_30d?: number | null
          github_contributors?: number | null
          github_forks?: number | null
          github_homepage?: string | null
          github_is_fork?: boolean | null
          github_issue_events_30d?: number | null
          github_language?: string | null
          github_languages?: Json | null
          github_last_activity?: string | null
          github_last_commit?: string | null
          github_open_issues?: number | null
          github_org_url?: string | null
          github_pr_events_30d?: number | null
          github_push_events_30d?: number | null
          github_recent_events?: Json | null
          github_releases_30d?: number | null
          github_stars?: number | null
          github_top_contributors?: Json | null
          github_topics?: Json | null
          github_username?: string | null
          governance_address?: string | null
          governance_analyzed_at?: string | null
          governance_last_activity?: string | null
          governance_tx_30d?: number | null
          id?: string | null
          integrated_score?: number | null
          liveness_status?: string | null
          logo_url?: string | null
          media_assets?: Json | null
          milestones?: Json | null
          openssf_analyzed_at?: string | null
          openssf_checks?: Json | null
          openssf_score?: number | null
          program_id?: string | null
          project_id?: string | null
          project_name?: string | null
          realms_analyzed_at?: string | null
          realms_dao_address?: string | null
          realms_delivery_rate?: number | null
          realms_last_proposal?: string | null
          realms_proposals_active?: number | null
          realms_proposals_completed?: number | null
          realms_proposals_total?: number | null
          resilience_score?: number | null
          score_breakdown?: Json | null
          staking_pitch?: string | null
          team_members?: Json | null
          telegram_url?: string | null
          tvl_analyzed_at?: string | null
          tvl_market_share?: number | null
          tvl_risk_ratio?: number | null
          tvl_usd?: number | null
          twitter_engagement_rate?: number | null
          twitter_followers?: number | null
          twitter_last_synced?: string | null
          twitter_recent_tweets?: Json | null
          updated_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          vulnerability_analyzed_at?: string | null
          vulnerability_count?: number | null
          vulnerability_details?: Json | null
          website_url?: string | null
          x_avatar_url?: string | null
          x_display_name?: string | null
          x_user_id?: string | null
          x_username?: string | null
        }
        Update: {
          build_in_public_videos?: Json | null
          bytecode_confidence?: string | null
          bytecode_deploy_slot?: number | null
          bytecode_hash?: string | null
          bytecode_match_status?: string | null
          bytecode_on_chain_hash?: string | null
          bytecode_verified_at?: string | null
          category?: string | null
          claim_status?: string | null
          country?: string | null
          created_at?: string | null
          dependency_analyzed_at?: string | null
          dependency_critical_count?: number | null
          dependency_health_score?: number | null
          dependency_outdated_count?: number | null
          description?: string | null
          discord_url?: string | null
          discovery_source?: string | null
          funding_requested_sol?: number | null
          funding_status?: string | null
          github_analyzed_at?: string | null
          github_commit_velocity?: number | null
          github_commits_30d?: number | null
          github_contributors?: number | null
          github_forks?: number | null
          github_homepage?: string | null
          github_is_fork?: boolean | null
          github_issue_events_30d?: number | null
          github_language?: string | null
          github_languages?: Json | null
          github_last_activity?: string | null
          github_last_commit?: string | null
          github_open_issues?: number | null
          github_org_url?: string | null
          github_pr_events_30d?: number | null
          github_push_events_30d?: number | null
          github_recent_events?: Json | null
          github_releases_30d?: number | null
          github_stars?: number | null
          github_top_contributors?: Json | null
          github_topics?: Json | null
          github_username?: string | null
          governance_address?: string | null
          governance_analyzed_at?: string | null
          governance_last_activity?: string | null
          governance_tx_30d?: number | null
          id?: string | null
          integrated_score?: number | null
          liveness_status?: string | null
          logo_url?: string | null
          media_assets?: Json | null
          milestones?: Json | null
          openssf_analyzed_at?: string | null
          openssf_checks?: Json | null
          openssf_score?: number | null
          program_id?: string | null
          project_id?: string | null
          project_name?: string | null
          realms_analyzed_at?: string | null
          realms_dao_address?: string | null
          realms_delivery_rate?: number | null
          realms_last_proposal?: string | null
          realms_proposals_active?: number | null
          realms_proposals_completed?: number | null
          realms_proposals_total?: number | null
          resilience_score?: number | null
          score_breakdown?: Json | null
          staking_pitch?: string | null
          team_members?: Json | null
          telegram_url?: string | null
          tvl_analyzed_at?: string | null
          tvl_market_share?: number | null
          tvl_risk_ratio?: number | null
          tvl_usd?: number | null
          twitter_engagement_rate?: number | null
          twitter_followers?: number | null
          twitter_last_synced?: string | null
          twitter_recent_tweets?: Json | null
          updated_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          vulnerability_analyzed_at?: string | null
          vulnerability_count?: number | null
          vulnerability_details?: Json | null
          website_url?: string | null
          x_avatar_url?: string | null
          x_display_name?: string | null
          x_user_id?: string | null
          x_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claimed_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_alerts: {
        Row: {
          description: string | null
          fired_at: string | null
          id: string | null
          logo_url: string | null
          protocol_category:
            | Database["public"]["Enums"]["protocol_category"]
            | null
          protocol_name: string | null
          protocol_slug: string | null
          severity: Database["public"]["Enums"]["alert_severity"] | null
          signal_snapshot: Json | null
          status: Database["public"]["Enums"]["alert_status"] | null
          subscriber_count: number | null
          title: string | null
        }
        Relationships: []
      }
      v_protocol_health: {
        Row: {
          active_p1: number | null
          active_p2: number | null
          active_p3: number | null
          canary_failures_1h: number | null
          category: Database["public"]["Enums"]["protocol_category"] | null
          id: string | null
          last_alert_at: string | null
          logo_url: string | null
          name: string | null
          program_address: string | null
          slug: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_resolve_stale_alerts: { Args: never; Returns: undefined }
      clean_expired_dedup: { Args: never; Returns: undefined }
      compute_zscore: {
        Args: {
          p_protocol_id: string
          p_signal_type: Database["public"]["Enums"]["signal_type"]
          p_value: number
          p_window?: string
        }
        Returns: number
      }
      get_alert_subscribers: {
        Args: {
          p_protocol_id: string
          p_severity: Database["public"]["Enums"]["alert_severity"]
        }
        Returns: {
          channel: Database["public"]["Enums"]["notification_channel"]
          config: Json
          destination: string
          subscriber_id: string
        }[]
      }
      get_score_changes: {
        Args: { profile_ids: string[] }
        Returns: {
          movement: string
          profile_id: string
        }[]
      }
      is_alert_deduped: {
        Args: { p_protocol_id: string; p_rule_id: string }
        Returns: boolean
      }
      prune_old_signals: { Args: never; Returns: undefined }
      refresh_signal_baselines: { Args: never; Returns: undefined }
      snapshot_date_day: { Args: { ts: string }; Returns: string }
    }
    Enums: {
      alert_severity: "P1" | "P2" | "P3" | "INFO"
      alert_status: "FIRING" | "RESOLVED" | "SUPPRESSED" | "ACKNOWLEDGED"
      canary_status: "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING"
      liveness_status: "ACTIVE" | "STALE" | "DECAYING"
      notification_channel:
        | "TELEGRAM"
        | "DISCORD"
        | "EMAIL"
        | "WEBHOOK"
        | "PUSH"
        | "ONCHAIN"
        | "SMS"
      protocol_category:
        | "DEX"
        | "BRIDGE"
        | "ORACLE"
        | "VALIDATOR"
        | "RPC"
        | "LENDING"
        | "LIQUID_STAKING"
        | "LAUNCHPAD"
        | "INFRASTRUCTURE"
      signal_type:
        | "TVL_DROP"
        | "ORACLE_DEVIATION"
        | "ORACLE_STALENESS"
        | "VALIDATOR_SKIP_RATE"
        | "SLOT_LAG"
        | "LIQUIDITY_DRAIN"
        | "BRIDGE_IMBALANCE"
        | "TX_FAILURE_SPIKE"
        | "STAKE_SHIFT"
        | "PRICE_IMPACT_INCREASE"
        | "CANARY_PROBE_FAILURE"
        | "CROSS_SIGNAL_CORRELATION"
        | "RPC_LATENCY_SPIKE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["P1", "P2", "P3", "INFO"],
      alert_status: ["FIRING", "RESOLVED", "SUPPRESSED", "ACKNOWLEDGED"],
      canary_status: ["ACTIVE", "SUSPENDED", "BANNED", "PENDING"],
      liveness_status: ["ACTIVE", "STALE", "DECAYING"],
      notification_channel: [
        "TELEGRAM",
        "DISCORD",
        "EMAIL",
        "WEBHOOK",
        "PUSH",
        "ONCHAIN",
        "SMS",
      ],
      protocol_category: [
        "DEX",
        "BRIDGE",
        "ORACLE",
        "VALIDATOR",
        "RPC",
        "LENDING",
        "LIQUID_STAKING",
        "LAUNCHPAD",
        "INFRASTRUCTURE",
      ],
      signal_type: [
        "TVL_DROP",
        "ORACLE_DEVIATION",
        "ORACLE_STALENESS",
        "VALIDATOR_SKIP_RATE",
        "SLOT_LAG",
        "LIQUIDITY_DRAIN",
        "BRIDGE_IMBALANCE",
        "TX_FAILURE_SPIKE",
        "STAKE_SHIFT",
        "PRICE_IMPACT_INCREASE",
        "CANARY_PROBE_FAILURE",
        "CROSS_SIGNAL_CORRELATION",
        "RPC_LATENCY_SPIKE",
      ],
    },
  },
} as const
