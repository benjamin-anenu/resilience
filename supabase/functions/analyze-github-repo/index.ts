import { createClient } from "npm:@supabase/supabase-js@2";
import { logServiceHealth } from "../_shared/service-health.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GitHubAnalysisResult {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  contributors: number;
  openIssues: number;
  createdAt: string;
  pushedAt: string;
  isFork: boolean;
  topics: string[];
  commitVelocity: number;
  commitsLast30Days: number;
  releasesLast30Days: number;
  latestRelease: { tag: string; date: string } | null;
  topContributors: Array<{ login: string; contributions: number; avatar: string }>;
  recentEvents: Array<{ type: string; actor: string; date: string; message?: string }>;
  resilienceScore: number;
  livenessStatus: "ACTIVE" | "STALE" | "DECAYING";
  daysSinceLastCommit: number;
  // Multi-signal activity tracking
  pushEvents30d: number;
  prEvents30d: number;
  issueEvents30d: number;
  lastActivity: string;
  daysSinceLastActivity: number;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?#]+)/,
    /github\.com\/([^\/]+)\/([^\/]+)\.git$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
  }
  return null;
}

async function fetchWithAuth(url: string, token: string): Promise<Response> {
  const start = Date.now();
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Rezilience-Registry",
    },
  });
  logServiceHealth("GitHub API", new URL(url).pathname, response.status, Date.now() - start, response.ok ? undefined : `HTTP ${response.status}`);
  return response;
}

/**
 * Fetches all events with pagination (up to 300 events / 3 pages)
 * GitHub Events API returns max 100 per page, and max 300 total
 */
async function fetchAllEvents(owner: string, repo: string, token: string): Promise<any[]> {
  const allEvents: any[] = [];
  const maxPages = 3; // GitHub limits to 300 events total
  
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetchWithAuth(
      `https://api.github.com/repos/${owner}/${repo}/events?per_page=100&page=${page}`,
      token
    );
    
    if (!response.ok) break;
    
    const events = await response.json();
    if (!Array.isArray(events) || events.length === 0) break;
    
    allEvents.push(...events);
    
    // If we got less than 100, we've reached the end
    if (events.length < 100) break;
  }
  
  console.log(`Fetched ${allEvents.length} total events via pagination`);
  return allEvents;
}

/**
 * Fetches commit statistics from GitHub Stats API
 * This is the authoritative source for weekly commit counts
 * Returns commits in the last 30 days (roughly 4-5 weeks)
 */
async function fetchCommitStats(owner: string, repo: string, token: string): Promise<number> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetchWithAuth(
      `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
      token
    );
    
    // 202 means GitHub is computing stats - wait and retry
    if (response.status === 202) {
      console.log(`Stats API computing (attempt ${attempt}/${maxRetries}), waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
    
    if (!response.ok) {
      console.log(`Stats API returned ${response.status}`);
      return 0;
    }
    
    const weeks = await response.json();
    if (!Array.isArray(weeks) || weeks.length === 0) return 0;
    
    // Sum commits from the last 5 weeks (approximately 30 days)
    const recentWeeks = weeks.slice(-5);
    const totalCommits = recentWeeks.reduce((sum: number, week: any) => sum + (week.total || 0), 0);
    
    console.log(`Stats API: ${totalCommits} commits in last ~5 weeks`);
    return totalCommits;
  }
  
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_url, profile_id } = await req.json();

    if (!github_url) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing github_url parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = parseGitHubUrl(github_url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid GitHub URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { owner, repo } = parsed;
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    if (!githubToken) {
      return new Response(
        JSON.stringify({ success: false, error: "GitHub integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing repository: ${owner}/${repo}`);

    // Fetch all data in parallel for speed
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceDate = thirtyDaysAgo.toISOString();

    // Fetch repo, commits, contributors, releases in parallel
    // Events and stats fetched separately with pagination/retry logic
    const [repoResponse, commitsResponse, contributorCountResponse, topContributorsResponse, releasesResponse, languagesResponse] = await Promise.all([
      fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`, githubToken),
      fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/commits?since=${sinceDate}&per_page=100`, githubToken),
      fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1`, githubToken),
      fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=5`, githubToken),
      fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`, githubToken),
      fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/languages`, githubToken),
    ]);

    // Check if repo exists
    if (repoResponse.status === 404) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Repository not found. It may be private - try connecting your GitHub account instead.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!repoResponse.ok) {
      console.error("GitHub API error:", await repoResponse.text());
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch repository data" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repoData = await repoResponse.json();
    
    // Fetch events with pagination (up to 300 events)
    const events = await fetchAllEvents(owner, repo, githubToken);
    
    // Fetch commit stats from Statistics API (authoritative source)
    const statsCommits = await fetchCommitStats(owner, repo, githubToken);
    
    // Parse commits from Commits API (default branch only)
    let commits: any[] = [];
    if (commitsResponse.ok) {
      commits = await commitsResponse.json();
    }
    
    // Parse contributor COUNT using Link header pagination trick
    let contributorCount = 0;
    if (contributorCountResponse.ok) {
      const linkHeader = contributorCountResponse.headers.get("Link");
      if (linkHeader) {
        const match = linkHeader.match(/[&?]page=(\d+)>;\s*rel="last"/);
        if (match) contributorCount = parseInt(match[1], 10);
      } else {
        const countData = await contributorCountResponse.json();
        contributorCount = Array.isArray(countData) ? countData.length : 0;
      }
    }
    console.log(`Contributor count (via Link header): ${contributorCount}`);
    
    // Parse top 5 contributors for display
    let contributors: any[] = [];
    if (topContributorsResponse.ok) {
      contributors = await topContributorsResponse.json();
    }
    
    // Parse releases
    let releases: any[] = [];
    if (releasesResponse.ok) {
      releases = await releasesResponse.json();
    }

    // Parse languages (returns { "Rust": 150000, "TypeScript": 42000, ... })
    let languages: Record<string, number> = {};
    if (languagesResponse.ok) {
      languages = await languagesResponse.json();
    }

    // Calculate metrics
    const defaultBranchCommits = commits.length;
    
    // === MULTI-SIGNAL ACTIVITY TRACKING ===
    // Filter events from last 30 days
    const eventsLast30Days = events.filter((e: any) => {
      const eventDate = new Date(e.created_at);
      return eventDate > thirtyDaysAgo;
    });

    // Count different activity types
    const pushEvents30d = eventsLast30Days.filter((e: any) => e.type === 'PushEvent').length;
    const prEvents30d = eventsLast30Days.filter((e: any) => e.type === 'PullRequestEvent').length;
    const issueEvents30d = eventsLast30Days.filter((e: any) => 
      e.type === 'IssuesEvent' || e.type === 'IssueCommentEvent'
    ).length;

    // Count actual commits from PushEvents (includes all branches)
    // Each PushEvent can contain multiple commits
    const pushEventCommits = eventsLast30Days
      .filter((e: any) => e.type === 'PushEvent')
      .reduce((sum: number, e: any) => sum + (e.payload?.size || 1), 0);

    // Use the HIGHEST of all three sources for accurate commit count:
    // 1. Default branch commits (from Commits API)
    // 2. Push event commits (from Events API - all branches)
    // 3. Stats API commits (authoritative weekly counts)
    const commitsLast30Days = Math.max(defaultBranchCommits, pushEventCommits, statsCommits);
    const commitVelocity = commitsLast30Days / 30; // commits per day

    console.log(`Commit sources: default=${defaultBranchCommits}, pushEvents=${pushEventCommits}, stats=${statsCommits}, final=${commitsLast30Days}`);

    const pushedAt = new Date(repoData.pushed_at);
    const now = new Date();
    const daysSinceLastCommit = Math.floor((now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24));

    // Filter releases in last 30 days
    const releasesLast30Days = releases.filter((r: any) => {
      const releaseDate = new Date(r.published_at);
      return releaseDate > thirtyDaysAgo;
    }).length;

    const latestRelease = releases[0]
      ? { tag: releases[0].tag_name, date: releases[0].published_at }
      : null;

    // Top contributors (from the separate per_page=5 call)
    const topContributors = contributors.slice(0, 5).map((c: any) => ({
      login: c.login,
      contributions: c.contributions,
      avatar: c.avatar_url,
    }));

    // Get most recent activity of ANY type (events are sorted by date desc)
    const lastActivity = events.length > 0 
      ? events[0].created_at 
      : repoData.pushed_at;
    const lastActivityDate = new Date(lastActivity);
    const daysSinceLastActivity = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));

    // Recent events (keep existing parsing)
    const recentEvents = events.slice(0, 10).map((e: any) => {
      const event: any = {
        type: e.type,
        actor: e.actor?.login || "unknown",
        date: e.created_at,
      };
      
      // Extract commit message for push events
      if (e.type === "PushEvent" && e.payload?.commits?.[0]) {
        event.message = e.payload.commits[0].message?.split("\n")[0] || "";
      }
      
      return event;
    });

    // Calculate Resilience Score using WEIGHTED ANTI-GAMING approach
    // Rebalanced to better reward solo builders with high activity
    let resilienceScore = 0;

    // === ANTI-GAMING: Fork Penalty ===
    const originalityMultiplier = repoData.fork ? 0.3 : 1.0;

    // === WEIGHTED ACTIVITY SCORE (0-40 points) ===
    // PRs weighted 2.5x, Issues 0.5x, Releases 10x
    // Daily cap prevents commit farming
    const cappedPushEvents = Math.min(pushEvents30d, 10 * 30);
    const cappedPrEvents = Math.min(prEvents30d, 5 * 30);
    const cappedIssueEvents = Math.min(issueEvents30d, 10 * 30);
    
    const weightedActivity = (
      (cappedPushEvents * 1.0) +
      (cappedPrEvents * 2.5) +
      (cappedIssueEvents * 0.5)
    );
    
    const adjustedActivity = weightedActivity * originalityMultiplier;
    
    // More granular tiers for 0-45 range
    if (adjustedActivity > 200) resilienceScore += 45;
    else if (adjustedActivity > 100) resilienceScore += 38;
    else if (adjustedActivity > 60) resilienceScore += 32;
    else if (adjustedActivity > 30) resilienceScore += 24;
    else if (adjustedActivity > 10) resilienceScore += 16;
    else if (adjustedActivity > 0) resilienceScore += 6;

    // === CONTRIBUTOR DIVERSITY (0-20 points) ===
    // Solo devs with high activity get 8 pts instead of 5
    const contributorCount = contributors.length;
    const isSoloHighActivity = contributorCount === 1 && adjustedActivity > 30;
    if (contributorCount > 20) resilienceScore += 20;
    else if (contributorCount > 10) resilienceScore += 17;
    else if (contributorCount >= 5) resilienceScore += 13;
    else if (contributorCount >= 3) resilienceScore += 10;
    else if (isSoloHighActivity) resilienceScore += 8;
    else if (contributorCount > 0) resilienceScore += 5;

    // === PROJECT AGE (0-10 points) ===
    const createdAt = new Date(repoData.created_at);
    const daysActive = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysActive > 365) resilienceScore += 10;
    else if (daysActive > 180) resilienceScore += 8;
    else if (daysActive > 90) resilienceScore += 5;
    else if (daysActive > 30) resilienceScore += 3;

    // === COMMIT CONSISTENCY (0-10 points) ===
    // Rewards sustained daily work rather than burst commits
    const estimatedActiveDays = Math.min(commitsLast30Days, 30);
    if (estimatedActiveDays >= 25) resilienceScore += 10;
    else if (estimatedActiveDays >= 20) resilienceScore += 8;
    else if (estimatedActiveDays >= 15) resilienceScore += 6;
    else if (estimatedActiveDays >= 10) resilienceScore += 4;
    else if (estimatedActiveDays >= 5) resilienceScore += 2;

    // === PR VELOCITY BONUS (0-8 points) ===
    // Rewards code review culture and merge throughput
    if (prEvents30d >= 15) resilienceScore += 8;
    else if (prEvents30d >= 8) resilienceScore += 6;
    else if (prEvents30d >= 3) resilienceScore += 4;
    else if (prEvents30d >= 1) resilienceScore += 2;

    // === ISSUE RESPONSIVENESS (0-7 points) ===
    // Rewards projects that engage with bug reports and feedback
    if (issueEvents30d >= 20) resilienceScore += 7;
    else if (issueEvents30d >= 10) resilienceScore += 5;
    else if (issueEvents30d >= 5) resilienceScore += 3;
    else if (issueEvents30d >= 1) resilienceScore += 1;

    // === DETERMINE LIVENESS STATUS ===
    // ACTIVE requires: activity in last 14 days, 5+ weighted events, AND 3+ contributors
    let livenessStatus: "ACTIVE" | "STALE" | "DECAYING";
    const hasMinContributors = contributorCount >= 1;
    const hasMeaningfulActivity = adjustedActivity >= 5;
    
    if (daysSinceLastActivity <= 14 && hasMeaningfulActivity && hasMinContributors) {
      livenessStatus = "ACTIVE";
    } else if (daysSinceLastActivity <= 45) {
      livenessStatus = "STALE";
    } else {
      livenessStatus = "DECAYING";
    }
    
    console.log(`Anti-gaming scoring: originalityMultiplier=${originalityMultiplier}, weightedActivity=${weightedActivity.toFixed(1)}, adjustedActivity=${adjustedActivity.toFixed(1)}, contributors=${contributorCount}, minContributors=${hasMinContributors}, status=${livenessStatus}`);

    resilienceScore = Math.min(Math.round(resilienceScore), 100);

    const result: GitHubAnalysisResult = {
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      htmlUrl: repoData.html_url,
      homepage: repoData.homepage,
      language: repoData.language,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      contributors: contributorCount,
      openIssues: repoData.open_issues_count,
      createdAt: repoData.created_at,
      pushedAt: repoData.pushed_at,
      isFork: repoData.fork,
      topics: repoData.topics || [],
      commitVelocity,
      commitsLast30Days,
      releasesLast30Days,
      latestRelease,
      topContributors,
      recentEvents,
      resilienceScore,
      livenessStatus,
      daysSinceLastCommit,
      // Multi-signal fields
      pushEvents30d,
      prEvents30d,
      issueEvents30d,
      lastActivity,
      daysSinceLastActivity,
    };

    console.log(`Analysis complete for ${owner}/${repo}: Score ${resilienceScore}, Status ${livenessStatus}, Commits=${commitsLast30Days}, Velocity=${commitVelocity.toFixed(2)}`);

    // If profile_id is provided, update the claimed_profiles table
    if (profile_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Update the claimed profile with latest metrics
        const { error: updateError } = await supabase
          .from("claimed_profiles")
          .update({
            github_org_url: github_url,
            github_stars: result.stars,
            github_forks: result.forks,
            github_contributors: result.contributors,
            github_language: result.language,
            github_last_commit: result.pushedAt,
            github_commit_velocity: result.commitVelocity,
            github_commits_30d: result.commitsLast30Days,
            github_releases_30d: result.releasesLast30Days,
            github_open_issues: result.openIssues,
            github_topics: result.topics,
            github_top_contributors: result.topContributors,
            github_recent_events: result.recentEvents,
            github_is_fork: result.isFork,
            github_homepage: result.homepage,
            github_analyzed_at: new Date().toISOString(),
            // resilience_score is written only by refresh-all-profiles (canonical integrated score)
            // liveness_status is written only by refresh-all-profiles
            // Multi-signal activity fields
            github_push_events_30d: result.pushEvents30d,
            github_pr_events_30d: result.prEvents30d,
            github_issue_events_30d: result.issueEvents30d,
            github_last_activity: result.lastActivity,
            github_languages: languages,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile_id);

        if (updateError) {
          console.error("Error updating claimed_profiles:", updateError);
        }

        // Score history is now written by refresh-all-profiles after final unified score calculation
        console.log(`GitHub analysis saved for profile ${profile_id} (score_history deferred to refresh cycle)`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error analyzing repository:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
