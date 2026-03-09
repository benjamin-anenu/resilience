

# Leaderboard Score Calculation Fixes + GitHub Token Update

## Status: ✅ COMPLETED

### Changes Made

1. **GITHUB_TOKEN secret** — Updated with new fine-grained PAT
2. **analyze-github-repo** — Fixed contributor count: uses `per_page=1` + Link header pagination for accurate counts (was capped at 10). Added `>50` tier for contributor diversity scoring.
3. **Leaderboard.tsx** — Fixed inverted "Least Vulnerabilities" metric (now correctly shows projects with fewest vulns). Added "Community" category with GitHub Stars.
4. **analyze-dependencies** — Changed default score from 50 to 0 for projects with no discoverable dependency files.
5. **useExplorerProjects** — Added `github_stars` to interface and query mapping.

### Next Steps
- Trigger a `refresh-all-profiles` run to recalculate all scores with the new token and fixes.
