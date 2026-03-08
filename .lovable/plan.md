

# Standalone Leaderboard Hub

## Overview
Create a dedicated `/leaderboard` page as a new top-level nav item, featuring multiple ranked categories derived from existing registry data. The current Builder Leaderboard moves here and is joined by several new rankings.

## Leaderboard Categories (all from existing `claimed_profiles` data)

| Tab | Metric | Data Source |
|-----|--------|-------------|
| **Builders** | Commit velocity, 30d commits, contributors | `github_commit_velocity`, `github_commits_30d`, `github_contributors` |
| **Resilience** | Overall resilience score | `resilience_score` |
| **Security** | OpenSSF scorecard + vulnerability count | `openssf_score`, `vulnerability_count` |
| **Governance** | Realms delivery rate + proposal activity | `realms_delivery_rate`, `governance_tx_30d` |
| **TVL** | Total value locked | `tvl_usd` |
| **Dependencies** | Supply chain health score | `dependency_health_score` |

No new database tables or edge functions needed — all data exists in `claimed_profiles_public`.

## Files to Create

### `src/pages/Leaderboard.tsx`
- Layout with hero header: "Ecosystem Leaderboard — Who's topping Solana?"
- Horizontal tab bar for each category
- Reusable ranked list component (medal icons, progress bars, project links)
- Each tab has its own sub-metric toggles (e.g., Builders tab keeps velocity/commits/contributors)
- Top 25 per category
- Mobile responsive cards

## Files to Modify

### `src/App.tsx`
- Add route: `/leaderboard` → `Leaderboard`

### `src/components/layout/Navigation.tsx`
- Add `Leaderboard` as a standalone top-level nav link (like README) with a Trophy icon, positioned between README and EXPLORE

### `src/pages/Explorer.tsx`
- Remove the `BuilderLeaderboard` embed from the list view (it now lives on `/leaderboard`)
- Add a "View Full Leaderboard →" link banner instead

