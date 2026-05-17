/**
 * Dashboard Layout
 * Layout for all protected dashboard routes
 */

'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrendingUp, LogOut, User, LayoutDashboard, ArrowLeftRight, Cpu, Crown, BarChart3, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useRef, useEffect, useState } from 'react';

/**
 * Atom spinner overlay shown briefly when navigating between sections.
 * Watches pathname changes and shows for 450 ms.
 */
function NavigationLoader() {
  const pathname = usePathname();
  const prevRef  = useRef(pathname);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname !== prevRef.current) {
      prevRef.current = pathname;
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 450);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none animate-fade-in"
      style={{ background: 'oklch(0.09 0.025 270 / 70%)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div className="relative h-16 w-16 flex items-center justify-center">
        {/* Nucleus */}
        <div
          className="absolute h-3 w-3 rounded-full bg-primary z-10 animate-pulse-glow"
          style={{ boxShadow: '0 0 14px #8B5CF6, 0 0 28px #8B5CF640' }}
        />
        {/* Orbit ring 1 */}
        <div className="absolute h-16 w-16 rounded-full border border-primary/25" />
        {/* Electron 1 */}
        <div className="absolute h-16 w-16 animate-orbit-fast">
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary"
            style={{ boxShadow: '0 0 10px #8B5CF6' }}
          />
        </div>
        {/* Orbit ring 2 (65° offset) */}
        <div className="absolute h-16 w-16 rounded-full border border-blue-400/20"
          style={{ transform: 'rotate(65deg)' }} />
        {/* Electron 2 */}
        <div className="absolute h-16 w-16" style={{ transform: 'rotate(65deg)' }}>
          <div className="absolute h-16 w-16 animate-orbit-rev">
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-blue-400"
              style={{ boxShadow: '0 0 8px #60A5FA' }}
            />
          </div>
        </div>
      </div>
      <p className="mt-4 text-[10px] text-muted-foreground/50 tracking-[0.3em] uppercase">ION</p>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const isAIActive = pathname.startsWith('/coach') || pathname.startsWith('/llm-portfolios') || pathname.startsWith('/wizard') || pathname.startsWith('/ai');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        {/* Atom / electron loading spinner */}
        <div className="relative h-16 w-16 flex items-center justify-center">
          {/* Nucleus */}
          <div
            className="absolute h-3 w-3 rounded-full bg-primary z-10 animate-pulse-glow"
            style={{ boxShadow: '0 0 14px #8B5CF6, 0 0 28px #8B5CF640' }}
          />
          {/* Orbit ring 1 */}
          <div className="absolute h-16 w-16 rounded-full border border-primary/25" />
          {/* Electron 1 */}
          <div className="absolute h-16 w-16 animate-orbit-fast">
            <div
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary"
              style={{ boxShadow: '0 0 10px #8B5CF6' }}
            />
          </div>
          {/* Orbit ring 2 (offset 65°) */}
          <div className="absolute h-16 w-16 rounded-full border border-blue-400/18"
            style={{ transform: 'rotate(65deg)' }} />
          {/* Electron 2 */}
          <div className="absolute h-16 w-16" style={{ transform: 'rotate(65deg)' }}>
            <div className="absolute h-16 w-16 animate-orbit-rev">
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-blue-400"
                style={{ boxShadow: '0 0 8px #60A5FA' }}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60 tracking-widest uppercase">ION</p>
      </div>
    );
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home',     active: pathname === '/dashboard' },
    { href: '/trade',     icon: ArrowLeftRight,  label: 'Trade',    active: pathname === '/trade' },
    { href: '/ai',        icon: Cpu,             label: 'AI',       active: isAIActive },
    { href: '/expert-investors', icon: Crown,    label: 'Expert',   active: pathname.startsWith('/expert-investors') },
    { href: '/benchmarks',       icon: BarChart3,label: 'Bench',    active: pathname.startsWith('/benchmarks') },
    { href: '/wallet',           icon: Wallet,   label: 'Wallet',   active: pathname.startsWith('/wallet') },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">

      {/* ── Ambient background blobs ─────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {/* Top-left purple blob */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.07] animate-blob"
          style={{
            background: 'radial-gradient(circle, oklch(0.68 0.26 265) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Top-right blue blob */}
        <div
          className="absolute -top-20 right-0 w-[500px] h-[500px] rounded-full opacity-[0.05] animate-blob delay-300"
          style={{
            background: 'radial-gradient(circle, oklch(0.65 0.22 240) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom-right violet blob */}
        <div
          className="absolute bottom-0 right-0 w-[450px] h-[450px] rounded-full opacity-[0.06] animate-blob delay-600"
          style={{
            background: 'radial-gradient(circle, oklch(0.65 0.22 290) 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(oklch(1 0 270 / 100%) 1px, transparent 1px),
              linear-gradient(90deg, oklch(1 0 270 / 100%) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06]"
        style={{
          background: 'linear-gradient(180deg, oklch(0.12 0.03 270 / 92%) 0%, oklch(0.10 0.025 270 / 85%) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-3 group">
              <div className="relative p-2 rounded-xl icon-glow-purple transition-all duration-300 group-hover:scale-105">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse-glow opacity-60" />
              </div>
              <div>
                <span className="text-lg font-bold gradient-text-primary tracking-tight">ION</span>
                <span className="text-xs text-muted-foreground ml-2 hidden lg:inline">Investment Optimized Network</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, icon: Icon, label, active }) => (
                <Link key={href} href={href}>
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                    transition-all duration-200 cursor-pointer
                    ${active
                      ? 'nav-pill-active text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
                    }
                  `}>
                    <Icon className="h-4 w-4" />
                    {label}
                    {active && (
                      <span className="nav-dot" />
                    )}
                  </div>
                </Link>
              ))}
            </nav>

            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 ring-1 ring-white/10 hover:ring-primary/40 transition-all">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
                    <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                      {profile?.display_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-semibold">{profile?.display_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-6 pb-28 md:pb-10 relative z-10">
        {children}
      </main>

      {/* ── Section transition loader ─────────────────────────────────────── */}
      <NavigationLoader />

      {/* ── Mobile Bottom Navigation ──────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t border-white/[0.07]"
        style={{
          background: 'linear-gradient(0deg, oklch(0.11 0.03 270 / 96%) 0%, oklch(0.10 0.025 270 / 90%) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex w-full px-2 py-1">
          {navItems.map(({ href, icon: Icon, label, active }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center py-2 gap-0.5"
            >
              <div className={`
                relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl w-full
                transition-all duration-200
                ${active ? 'text-primary' : 'text-muted-foreground'}
              `}>
                {active && (
                  <div className="absolute inset-0 rounded-xl bg-primary/10" />
                )}
                <Icon className={`h-5 w-5 relative z-10 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-medium relative z-10 leading-none">
                  {label}
                </span>
                {active && <span className="nav-dot absolute -bottom-0.5" />}
              </div>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
