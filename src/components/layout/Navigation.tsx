import { useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, User, LogOut, X as XIcon, ChevronDown,
  Compass, GitBranch, Coins, Rocket, Gift,
  Activity, Globe, MessageCircle,
  Target, FolderKanban,
  BookOpen, Layers, BookA, Trophy, Shield,
} from 'lucide-react';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Drawer, DrawerClose, DrawerContent, DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import logo from '@/assets/logo.png';
import type { LucideIcon } from 'lucide-react';

/* ─── Menu data ─────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'EXPLORE',
    items: [
      { href: '/explorer', label: 'Explorer', description: 'Browse & score Solana projects', icon: Compass },
      { href: '/deps', label: 'Dependency Map', description: 'Supply-chain visualization', icon: GitBranch },
      { href: '/grants', label: 'Grants', description: 'Discover ecosystem funding', icon: Coins },
      { href: '/airdrops', label: 'Airdrops', description: 'Token launches & airdrop calendar', icon: Gift },
    ],
  },
  {
    label: 'MONITOR',
    items: [
      { href: '/tools', label: 'Tools', description: 'RPC health, fee tracker, address lookup, tx decoder', icon: Activity },
      { href: '/deploy-feed', label: 'Deploy Feed', description: 'Real-time program deploys & upgrades', icon: Rocket },
      { href: '/tools?tab=status', label: 'Ecosystem Status', description: 'Service uptime dashboard', icon: Globe },
      { href: '/gpt', label: 'GPT', description: 'AI-powered Solana intelligence', icon: MessageCircle },
    ],
  },
  {
    label: 'TRACK',
    items: [
      { href: '/accountability', label: 'DAO Tracker', description: 'Track milestone delivery across DAOs', icon: Target },
      { href: '/bounty-board', label: 'Projects', description: 'Claim work, submit evidence, earn SOL', icon: FolderKanban },
    ],
  },
  {
    label: 'BUILD',
    items: [
      { href: '/library', label: 'Library', description: 'Docs, blueprints & learning paths', icon: BookOpen },
      { href: '/library/protocols', label: 'Protocols', description: 'Integration registry', icon: Layers },
      { href: '/library/dictionary', label: 'Dictionary', description: 'Solana terminology', icon: BookA },
    ],
  },
];

/* ─── Desktop mega-dropdown ─────────────────────────────── */

function NavDropdown({ group, isActive }: { group: NavGroup; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { trackEvent } = useAnalyticsTracker();

  const handleEnter = useCallback(() => { clearTimeout(timeoutRef.current); setOpen(true); }, []);
  const handleLeave = useCallback(() => { timeoutRef.current = setTimeout(() => setOpen(false), 180); }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={cn(
            'flex items-center gap-1 font-display text-sm font-medium tracking-wider transition-colors hover:text-foreground',
            isActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {group.label}
          <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={14}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="w-[320px] rounded-lg border border-primary/10 bg-card/90 p-2 shadow-xl shadow-black/20 backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-50 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      >
        {/* Category header */}
        <p className="mb-1.5 px-3 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {group.label}
        </p>
        <div className="mb-1 h-px bg-border/50" />

        {group.items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => { trackEvent('click', `nav_${item.label.toLowerCase()}`); setOpen(false); }}
            className="group flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-primary/5"
          >
            {/* Icon */}
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/30 transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
              <item.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>

            {/* Text */}
            <div className="min-w-0">
              <span className="font-display text-sm font-semibold tracking-wide text-foreground">
                {item.label}
              </span>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main Navigation ───────────────────────────────────── */

export function Navigation() {
  const location = useLocation();
  const { user, isAuthenticated, signOut, signInWithX } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [notifOpen, setNotifOpen] = useState(false);

  const isActiveRoute = (href: string) => location.pathname === href;
  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => location.pathname.startsWith(item.href.split('?')[0]));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Rezilience" className="h-8 w-8 object-contain" />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">REZILIENCE</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              to="/readme"
              onClick={() => trackEvent('click', 'nav_readme')}
              className={cn(
                'font-display text-sm font-medium tracking-wider transition-colors hover:text-foreground',
                isActiveRoute('/readme') ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              README
            </Link>

            <Link
              to="/leaderboard"
              onClick={() => trackEvent('click', 'nav_leaderboard')}
              className={cn(
                'flex items-center gap-1 font-display text-sm font-medium tracking-wider transition-colors hover:text-foreground',
                isActiveRoute('/leaderboard') ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Trophy className="h-3.5 w-3.5" />
              LEADERBOARD
            </Link>

            <Link
              to="/aegis"
              onClick={() => trackEvent('click', 'nav_aegis')}
              className={cn(
                'flex items-center gap-1 font-display text-sm font-medium tracking-wider transition-colors hover:text-foreground',
                isActiveRoute('/aegis') ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              AEGIS
            </Link>

            {navGroups.map((group) => (
              <NavDropdown key={group.label} group={group} isActive={isGroupActive(group)} />
            ))}

            {isAuthenticated && (
              <Link
                to="/dashboard"
                className={cn(
                  'font-display text-sm font-medium tracking-wider transition-colors hover:text-foreground',
                  isActiveRoute('/dashboard') ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                MY REGISTRY
              </Link>
            )}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                <NotificationBell onClick={() => setNotifOpen(true)} />
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1.5 transition-colors hover:border-primary/50"
                >
                  <img src={user.avatarUrl} alt={user.username} className="h-6 w-6 rounded-full" />
                  <span className="font-mono text-sm text-muted-foreground">@{user.username}</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={signInWithX}
                  className="font-display font-semibold uppercase tracking-wider bg-background border-primary text-foreground hover:bg-primary/10"
                >
                  SIGN IN
                </Button>
                <Button asChild className="font-display font-semibold uppercase tracking-wider">
                  <Link to="/claim-profile">
                    <User className="mr-2 h-4 w-4" />
                    JOIN THE REGISTRY
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          <Drawer direction="right">
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden touch-feedback">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="fixed inset-y-0 right-0 left-auto h-full w-[85vw] max-w-sm rounded-none border-l border-border bg-background safe-bottom">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-border p-4">
                <Link to="/" className="flex items-center gap-2">
                  <img src={logo} alt="Rezilience" className="h-6 w-6 object-contain" />
                  <span className="font-display text-lg font-bold tracking-tight text-foreground">REZILIENCE</span>
                </Link>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="touch-feedback">
                    <XIcon className="h-5 w-5" />
                  </Button>
                </DrawerClose>
              </div>

              {/* User Profile */}
              {isAuthenticated && user && (
                <div className="border-b border-border p-4">
                  <div className="flex items-center gap-3 rounded-sm border border-border bg-card/50 p-3">
                    <img src={user.avatarUrl} alt={user.username} className="h-10 w-10 rounded-full ring-2 ring-primary/20" />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-foreground truncate">@{user.username}</p>
                      <p className="text-xs text-muted-foreground">Connected via X</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* README */}
                <DrawerClose asChild>
                  <Link
                    to="/readme"
                    className={cn(
                      'flex min-h-[48px] items-center gap-3 rounded-sm px-3 py-3 font-display text-sm font-medium tracking-wider transition-colors hover:bg-muted/50 touch-feedback',
                      isActiveRoute('/readme')
                        ? 'border-l-2 border-primary bg-primary/5 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    README
                  </Link>
                </DrawerClose>

                {/* AEGIS */}
                <DrawerClose asChild>
                  <Link
                    to="/aegis"
                    className={cn(
                      'flex min-h-[48px] items-center gap-3 rounded-sm px-3 py-3 font-display text-sm font-medium tracking-wider transition-colors hover:bg-muted/50 touch-feedback',
                      isActiveRoute('/aegis')
                        ? 'border-l-2 border-primary bg-primary/5 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    AEGIS
                  </Link>
                </DrawerClose>

                {/* Groups */}
                {navGroups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1 mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <DrawerClose key={item.href} asChild>
                          <Link
                            to={item.href}
                            className={cn(
                              'flex min-h-[48px] items-center gap-3 rounded-sm px-3 py-3 font-display text-sm font-medium tracking-wider transition-colors hover:bg-muted/50 touch-feedback',
                              isActiveRoute(item.href.split('?')[0])
                                ? 'border-l-2 border-primary bg-primary/5 text-primary'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {item.label.toUpperCase()}
                          </Link>
                        </DrawerClose>
                      ))}
                    </div>
                  </div>
                ))}

                {isAuthenticated && (
                  <>
                    <p className="mb-1 mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3">
                      Account
                    </p>
                    <DrawerClose asChild>
                      <Link
                        to="/dashboard"
                        className={cn(
                          'flex min-h-[48px] items-center rounded-sm px-3 py-3 font-display text-sm font-medium tracking-wider transition-colors hover:bg-muted/50 touch-feedback',
                          isActiveRoute('/dashboard')
                            ? 'border-l-2 border-primary bg-primary/5 text-primary'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        MY REGISTRY
                      </Link>
                    </DrawerClose>
                  </>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="border-t border-border p-4 space-y-3">
                {isAuthenticated ? (
                  <DrawerClose asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] font-display font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive touch-feedback"
                      onClick={signOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      SIGN OUT
                    </Button>
                  </DrawerClose>
                ) : (
                  <>
                    <DrawerClose asChild>
                      <Button
                        variant="outline"
                        onClick={signInWithX}
                        className="w-full min-h-[48px] font-display font-semibold uppercase tracking-wider bg-background border-primary text-foreground hover:bg-primary/10 touch-feedback"
                      >
                        SIGN IN
                      </Button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Button asChild className="w-full min-h-[48px] font-display font-semibold uppercase tracking-wider touch-feedback">
                        <Link to="/claim-profile">
                          <User className="mr-2 h-4 w-4" />
                          JOIN THE REGISTRY
                        </Link>
                      </Button>
                    </DrawerClose>
                  </>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Notification Panel */}
      {isAuthenticated && <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />}
    </nav>
  );
}
