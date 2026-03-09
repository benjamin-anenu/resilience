

# Leaderboard Score Calculation Fixes + GitHub Token Update

## Issues Found

### 1. Expired GitHub Token (Root Cause)
The edge function logs show `"Bad credentials"` from `analyze-github-repo`. Your `GITHUB_TOKEN` secret has expired, causing all GitHub analysis to fail. This means scores are frozen at stale values and not updating.

**Fix:** Update the `GITHUB_TOKEN` secret with the new fine-grained PAT you provided.

### 2. Contributors Capped at 10
The `analyze-github-repo` edge function fetches contributors with `per_page=10` (line 184), so `github_contributors` is always <= 10. This caps the "Contributor Diversity" score at 5/20 points for most projects. 74 out of 231 profiles show exactly 10 contributors — they likely have more.

**Fix:** Use the `per_page=1` + `Link` header pagination trick (like `fetch-github` already does) to get actual contributor counts, while still fetching top 5 contributor details separately.

### 3. Dependency Health Score Always 50
All 231 profiles have `dependency_health_score = 50` (the default). The `analyze-dependencies` function often fails to find dependency files (Cargo.toml, package.json) and falls back to 50. This means the Dependencies dimension (25-40% weight) adds zero differentiation.

**Fix:** Improve the dependency analyzer's file discovery (try more paths, check GitHub tree API), and use a more meaningful default (e.g., 0 for "unknown" rather than 50).

### 4. Leaderboard "Least Vulnerabilities" Metric is Inverted
The Security tab's "Least Vulnerabilities" sub-metric uses `getValue: (p) => -(p.vulnerability_count || 0)`, which correctly sorts lowest-first, but projects with `null` vulnerability_count default to 0 and appear as "best". The filter `!== 0` then excludes them. So only projects WITH vulnerabilities show up — the opposite of intent.

**Fix:** Change the filter to show all scanned projects and sort by ascending vulnerability count.

## Implementation Plan

### File 1: Update `GITHUB_TOKEN` secret
Use the `add_secret` tool to set the new token value.

### File 2: `supabase/functions/analyze-github-repo/index.ts`
- Line 184: Change contributor fetch to `per_page=1` and parse `Link` header for total count
- Add a separate call to fetch top 5 contributors for display
- This gives accurate contributor counts for scoring

### File 3: `src/pages/Leaderboard.tsx`
- Fix the "Least Vulnerabilities" metric:
  - Change `getValue` to use raw `vulnerability_count` (ascending sort)
  - Change `format` to show count directly
  - Fix filter to include scanned projects (those with `vulnerability_analyzed_at`)
- Add a "Community" category using `github_stars` and `twitter_followers` for broader ranking variety

### File 4: `supabase/functions/analyze-dependencies/index.ts`
- Use GitHub Trees API to discover dependency files instead of guessing paths
- Set default score to 0 instead of 50 for projects with no discoverable dependencies

### Deployment
After code changes, redeploy `analyze-github-repo` and `analyze-dependencies` edge functions, then trigger a `refresh-all-profiles` run to recalculate all scores with the new token.

