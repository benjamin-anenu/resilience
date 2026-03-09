import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "@/providers/WalletProvider";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import Explorer from "./pages/Explorer";
import ProgramDetail from "./pages/ProgramDetail";
import ProfileDetail from "./pages/ProfileDetail";
import ClaimProfile from "./pages/ClaimProfile";
import GitHubCallback from "./pages/GitHubCallback";
import XCallback from "./pages/XCallback";
import Dashboard from "./pages/Dashboard";
import Accountability from "./pages/Accountability";
import AccountabilityDetail from "./pages/AccountabilityDetail";
import Readme from "./pages/Readme";
import DependencyTree from "./pages/DependencyTree";
import Grants from "./pages/Grants";
import AirdropCalendar from "./pages/AirdropCalendar";
import Library from "./pages/Library";
import LibraryLearn from "./pages/LibraryLearn";
import LibraryDictionary from "./pages/LibraryDictionary";
import LibraryBlueprints from "./pages/LibraryBlueprints";
import LibraryBlueprintDetail from "./pages/LibraryBlueprintDetail";
import LibraryProtocols from "./pages/LibraryProtocols";
import ProtocolDetail from "./pages/ProtocolDetail";
import LibraryDocs from "./pages/LibraryDocs";
import PitchDeck from "./pages/PitchDeck";
import ResilienceGPT from "./pages/ResilienceGPT";
import Terms from "./pages/Terms";
import HackathonDemo from "./pages/HackathonDemo";
import BountyBoard from "./pages/BountyBoard";
import Tools from "./pages/Tools";
import DeployFeed from "./pages/DeployFeed";
import Leaderboard from "./pages/Leaderboard";
import Aegis from "./pages/Aegis";
import NotFound from "./pages/NotFound";

// Admin imports
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOverview from "./pages/admin/AdminOverview";
import { AdminEngagement } from "./pages/admin/AdminEngagementPage";
import { AdminAIUsage } from "./pages/admin/AdminAIUsagePage";
import { AdminIntegrations } from "./pages/admin/AdminIntegrationsPage";
import { AdminCosts } from "./pages/admin/AdminCostsPage";
import { AdminRegistry } from "./pages/admin/AdminRegistryPage";
import { AdminReporter } from "./pages/admin/AdminReporterPage";
import { AdminRecalibrate } from "./pages/admin/AdminRecalibratePage";
import { AdminTrends } from "./pages/admin/AdminTrendsPage";
import { AdminProtectedRoute } from "./components/admin/AdminProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/readme" element={<Readme />} />
              <Route path="/explorer" element={<Explorer />} />
              <Route path="/program/:id" element={<ProgramDetail />} />
              <Route path="/profile/:id" element={<ProfileDetail />} />
              <Route path="/claim-profile" element={<ClaimProfile />} />
              <Route path="/github-callback" element={<GitHubCallback />} />
              <Route path="/x-callback" element={<XCallback />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/accountability" element={<Accountability />} />
              <Route path="/accountability/:realmAddress" element={<AccountabilityDetail />} />
              <Route path="/bounty-board" element={<BountyBoard />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              {/* Legacy redirects */}
              <Route path="/staking" element={<Navigate to="/accountability" replace />} />
              <Route path="/my-bonds" element={<Navigate to="/accountability" replace />} />
              <Route path="/deps/:id" element={<DependencyTree />} />
              <Route path="/grants" element={<Grants />} />
              <Route path="/airdrops" element={<AirdropCalendar />} />
              <Route path="/library" element={<Library />} />
              <Route path="/library/learn" element={<LibraryLearn />} />
              <Route path="/library/learn/:level" element={<LibraryLearn />} />
              <Route path="/library/dictionary" element={<LibraryDictionary />} />
              <Route path="/library/blueprints" element={<LibraryBlueprints />} />
              <Route path="/library/blueprints/:slug" element={<LibraryBlueprintDetail />} />
              <Route path="/library/protocols" element={<LibraryProtocols />} />
              <Route path="/library/docs" element={<LibraryDocs />} />
              <Route path="/library/:slug" element={<ProtocolDetail />} />
              <Route path="/pitch" element={<PitchDeck />} />
              <Route path="/gpt" element={<ResilienceGPT />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/demo" element={<HackathonDemo />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/deploy-feed" element={<DeployFeed />} />

              {/* Admin Portal */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>}>
                <Route index element={<AdminOverview />} />
                <Route path="engagement" element={<AdminEngagement />} />
                <Route path="ai" element={<AdminAIUsage />} />
                <Route path="integrations" element={<AdminIntegrations />} />
                <Route path="costs" element={<AdminCosts />} />
                <Route path="registry" element={<AdminRegistry />} />
                <Route path="recalibrate" element={<AdminRecalibrate />} />
                <Route path="trends" element={<AdminTrends />} />
                <Route path="reporter" element={<AdminReporter />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
