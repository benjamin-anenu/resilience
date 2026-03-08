import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useTrackEvent } from '@/components/layout/Layout';
import { EcosystemStats, EcosystemHeatmap, EcosystemPulse, SearchBar, ProgramLeaderboard, BuildersInPublicFeed } from '@/components/explorer';
import { TrendTicker } from '@/components/explorer/TrendTicker';
import { TrendTicker } from '@/components/explorer/TrendTicker';
import { TrendFeed } from '@/components/explorer/TrendFeed';
import { useExplorerProjects } from '@/hooks/useExplorerProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Megaphone, ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

type ActiveView = 'list' | 'heatmap' | 'pulse' | 'builders';

const ITEMS_PER_PAGE = 60;

const Explorer = () => {
  const [searchParams] = useSearchParams();
  const trackEvent = useTrackEvent();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeView, setActiveView] = useState<ActiveView>('list');
  const [showTrendFeed, setShowTrendFeed] = useState(false);
  const { data: projects, isLoading, error } = useExplorerProjects();

  // Read country from URL params (e.g. from map click)
  useEffect(() => {
    const country = searchParams.get('country');
    if (country) setCountryFilter(country);
  }, [searchParams]);

  const filteredPrograms = useMemo(() => {
    if (!projects) return [];
    
    return projects.filter((project) => {
      const matchesSearch =
        searchQuery === '' ||
        project.program_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.program_id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || project.liveness_status === statusFilter.toUpperCase();

      const matchesVerification =
        verificationFilter === 'all' ||
        (verificationFilter === 'verified' && project.verified) ||
        (verificationFilter === 'unverified' && !project.verified);

      const matchesCategory =
        categoryFilter === 'all' || project.category === categoryFilter;

      const matchesCountry =
        countryFilter === 'all' || project.country === countryFilter;

      return matchesSearch && matchesStatus && matchesVerification && matchesCategory && matchesCountry;
    });
  }, [projects, searchQuery, statusFilter, verificationFilter, categoryFilter, countryFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPrograms.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPrograms = filteredPrograms.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    if (searchQuery) trackEvent('search', searchQuery, { page: 'explorer' });
  }, [searchQuery, statusFilter, verificationFilter, categoryFilter, countryFilter, trackEvent]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Layout>
      <div className="py-8">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div>
              <h1 className="mb-2 font-display text-3xl font-bold uppercase tracking-tight text-foreground md:text-4xl">
                REZILIENCE REGISTRY
              </h1>
            <p className="text-muted-foreground">
              Browse verified projects and their trust metrics across the Solana ecosystem.
            </p>
            </div>
          </div>

          {/* Ecosystem Stats */}
          <div className="mb-6">
            <EcosystemStats />
          </div>

          {/* Trend Ticker */}
          <div className="mb-4">
            <TrendTicker onViewAll={() => setShowTrendFeed(!showTrendFeed)} />
          </div>

          {/* Expanded Trend Feed */}
          {showTrendFeed && (
            <div className="mb-6">
              <TrendFeed onClose={() => setShowTrendFeed(false)} />
            </div>
          )}

          {/* View Toggle Row: BIP standalone left, data tabs right */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant={activeView === 'builders' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const next = activeView === 'builders' ? 'list' : 'builders';
                setActiveView(next);
                trackEvent('tab_change', next, { page: 'explorer' });
              }}
              className="flex items-center gap-2"
            >
              {activeView === 'builders' ? (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  Back to Registry
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4" />
                  View Builders In Public
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <Tabs
              value={activeView === 'builders' ? '' : activeView}
              onValueChange={(v) => { if (v) { setActiveView(v as ActiveView); trackEvent('tab_change', v, { page: 'explorer' }); } }}
              className="w-auto"
            >
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="list">List View</TabsTrigger>
                <TabsTrigger value="heatmap">Titan Watch</TabsTrigger>
                <TabsTrigger value="pulse">Ecosystem Pulse</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* View Content */}
          {activeView === 'builders' && (
            <div className="mt-4">
              <BuildersInPublicFeed />
            </div>
          )}

          {activeView === 'heatmap' && (
            <div className="mt-4">
              <EcosystemHeatmap />
            </div>
          )}

          {activeView === 'pulse' && (
            <div className="mt-4">
              <EcosystemPulse />
            </div>
          )}

          {activeView === 'list' && (
            <>
          {/* Builder Leaderboard */}
          {!isLoading && projects && projects.length > 0 && (
            <div className="mb-6">
              <BuilderLeaderboard projects={projects} />
            </div>
          )}

          {/* Search & Filters */}
          <div className="mb-6">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              verificationFilter={verificationFilter}
              onVerificationFilterChange={setVerificationFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
            />
          </div>

          {/* Results count */}
          <div className="mb-4">
            {isLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-mono text-foreground">{startIndex + 1}-{Math.min(endIndex, filteredPrograms.length)}</span> of <span className="font-mono text-foreground">{filteredPrograms.length}</span> registered projects
              </p>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 rounded-sm border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">
                Failed to load programs. Please try again later.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredPrograms.length === 0 && (
            <div className="rounded-sm border border-border bg-card p-12 text-center">
              <div className="mx-auto max-w-md">
                <h3 className="mb-2 font-display text-lg font-semibold uppercase text-foreground">
                  {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || countryFilter !== 'all' 
                    ? 'No Matches Found' 
                    : 'No Registered Projects Yet'}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || countryFilter !== 'all'
                    ? 'No projects match your search criteria. Try adjusting your filters.'
                    : 'Be among the first builders to register your project in the Rezilience Registry.'}
                </p>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {!isLoading && !error && paginatedPrograms.length > 0 && (
            <ProgramLeaderboard projects={paginatedPrograms} />
          )}

          {/* Pagination Controls */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((page, idx) => (
                    <PaginationItem key={idx}>
                      {page === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Explorer;
