/**
 * Dashboard Page
 * Main dashboard with portfolio overview
 */

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useBalance, usePortfolio, usePortfolioSummary, useResetPortfolio } from '@/hooks/use-portfolio';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  DollarSign, TrendingUp, Activity, ArrowRight, Brain, RotateCcw,
  RefreshCw, Sparkles, Trophy, Copy, X, ChevronRight, Loader2,
} from 'lucide-react';
import { useCoachSummary } from '@/hooks/use-coach';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';

// ── Leaderboard types ─────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank:           number;
  id:             string;
  name:           string;
  category:       'ai' | 'llm' | 'quant' | 'expert' | 'benchmark';
  categoryLabel:  string;
  portfolioType:  string;
  slug:           string;
  portfolioId?:   string;
  initialBalance: number;
  totalValue:     number;
  totalReturnPct: number;
  totalReturnUsd: number;
  openPositions:  number | null;
  isInitialized:  boolean;
}

interface CopyPosition {
  symbol:        string;
  assetName:     string;
  assetType:     string;
  market:        string;
  allocationPct: number;
}

// ── Leaderboard data fetchers ─────────────────────────────────────────────────

async function fetchLeaderboard(): Promise<{ entries: LeaderboardEntry[] }> {
  const res = await fetch('/api/leaderboard');
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

async function fetchPositions(entry: LeaderboardEntry): Promise<CopyPosition[]> {
  const params = new URLSearchParams({
    type: entry.portfolioType,
    slug: entry.slug,
    ...(entry.portfolioId ? { portfolioId: entry.portfolioId } : {}),
  });
  const res = await fetch(`/api/leaderboard/copy?${params}`);
  if (!res.ok) throw new Error('Failed to fetch positions');
  const data = await res.json();
  return data.positions || [];
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  ai:        { bg: 'bg-violet-500/15', text: 'text-violet-300',  border: 'border-violet-500/25' },
  llm:       { bg: 'bg-blue-500/15',   text: 'text-blue-300',    border: 'border-blue-500/25' },
  quant:     { bg: 'bg-amber-500/15',  text: 'text-amber-300',   border: 'border-amber-500/25' },
  expert:    { bg: 'bg-emerald-500/15',text: 'text-emerald-300', border: 'border-emerald-500/25' },
  benchmark: { bg: 'bg-gray-500/15',   text: 'text-gray-300',    border: 'border-gray-500/25' },
};

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const PORTFOLIO_HREF: Partial<Record<string, string>> = {
  coach:      '/coach',
  finetune:   '/coach/fine-tune',
  prometheus: '/ai/pharma-intel',
  merlin:     '/wizard/merlin',
  houdini:    '/wizard/houdini',
};

// ── Copy Modal ────────────────────────────────────────────────────────────────

function CopyModal({
  entry,
  availableCash,
  onClose,
  onSuccess,
}: {
  entry: LeaderboardEntry;
  availableCash: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [allocatePct, setAllocatePct] = useState(50);
  const [executing, setExecuting]     = useState(false);

  const { data: positions, isLoading } = useQuery({
    queryKey: ['copy-positions', entry.portfolioType, entry.slug, entry.portfolioId],
    queryFn:  () => fetchPositions(entry),
  });

  const allocateCash = (allocatePct / 100) * availableCash;

  const handleCopy = useCallback(async () => {
    if (!positions?.length) return;
    setExecuting(true);
    try {
      const res = await fetch('/api/leaderboard/copy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ positions, allocateCash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Copied ${data.bought} position${data.bought !== 1 ? 's' : ''} from ${entry.name}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Copy failed');
    } finally {
      setExecuting(false);
    }
  }, [positions, allocateCash, entry.name, onSuccess, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md glass-card rounded-2xl card-gradient-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <div>
            <h3 className="text-sm font-bold text-foreground">Copy {entry.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Replicate positions into your portfolio
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Allocation slider */}
        <div className="p-4 border-b border-white/8 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Allocate from your cash</span>
            <span className="font-bold text-foreground">
              ${allocateCash.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              <span className="text-muted-foreground font-normal ml-1">({allocatePct}%)</span>
            </span>
          </div>
          <input
            type="range" min={5} max={100} step={5}
            value={allocatePct}
            onChange={e => setAllocatePct(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>5%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        {/* Positions list */}
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !positions?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No open positions to copy
            </div>
          ) : (
            <div className="divide-y divide-white/6">
              {positions.map(p => (
                <div key={p.symbol} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{p.symbol}</span>
                    {p.assetName !== p.symbol && (
                      <span className="text-xs text-muted-foreground ml-2 truncate max-w-32 inline-block">{p.assetName}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-foreground">{p.allocationPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground">
                      ≈${((p.allocationPct / 100) * allocateCash).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/8 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 btn-shimmer text-white border-0"
            disabled={!positions?.length || executing || allocateCash < 1}
            onClick={handleCopy}
          >
            {executing
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Executing…</>
              : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy {positions?.length || 0} positions</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  onCopy,
}: {
  entry: LeaderboardEntry;
  onCopy: (e: LeaderboardEntry) => void;
}) {
  const cat   = CATEGORY_STYLE[entry.category];
  const isPos = entry.totalReturnPct >= 0;
  const href  = entry.portfolioType === 'llm'    ? '/llm-portfolios'
              : entry.portfolioType === 'expert'  ? '/expert-investors'
              : entry.portfolioType === 'benchmark' ? '/benchmarks'
              : PORTFOLIO_HREF[entry.slug] || '#';

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors group">
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        {RANK_MEDAL[entry.rank]
          ? <span className="text-base">{RANK_MEDAL[entry.rank]}</span>
          : <span className="text-sm font-bold text-muted-foreground/60">#{entry.rank}</span>
        }
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{entry.name}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cat.bg} ${cat.text} ${cat.border}`}>
            {entry.categoryLabel}
          </span>
        </div>
        {entry.openPositions !== null && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {entry.openPositions} open position{entry.openPositions !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Return */}
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPos ? '+' : ''}{entry.totalReturnPct.toFixed(2)}%
        </div>
        <div className={`text-xs ${isPos ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {isPos ? '+' : ''}${Math.abs(entry.totalReturnUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onCopy(entry)}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-white/6 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all flex items-center gap-1 border border-white/8"
          title="Copy positions into your portfolio"
        >
          <Copy className="h-3 w-3" />
          <span className="hidden sm:inline">Copy</span>
        </button>
        <Link href={href}>
          <button className="text-muted-foreground/50 hover:text-foreground transition-colors p-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: balance } = useBalance();
  const { holdings } = usePortfolio();
  const summary = usePortfolioSummary();
  const coachSummary = useCoachSummary();
  const resetPortfolio = useResetPortfolio();
  const qc = useQueryClient();
  const [confirmReset, setConfirmReset]   = useState(false);
  const [copyTarget, setCopyTarget]       = useState<LeaderboardEntry | null>(null);

  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn:  fetchLeaderboard,
    staleTime: 2 * 60 * 1000,
  });
  const leaderboard = lbData?.entries || [];

  const handleReset = async () => {
    try {
      await resetPortfolio.mutateAsync();
      setConfirmReset(false);
      toast.success('Portfolio reset. Balance restored to $100,000.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset portfolio');
    }
  };

  return (
    <div className="space-y-7 px-1 md:px-0">

      {/* ── Welcome Section ─────────────────────────────────────────────── */}
      <div className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary opacity-70" />
            <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
              Portfolio Overview
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">
            Welcome back, {profile?.display_name || 'Trader'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your investments
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Link href="/trade">
            <Button className="w-full sm:w-auto btn-shimmer text-white border-0 font-semibold">
              Start Trading
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          {confirmReset ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs">Reset all trades &amp; restore $100k?</span>
              <Button size="sm" variant="destructive" onClick={handleReset} disabled={resetPortfolio.isPending}>
                {resetPortfolio.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, reset'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restart Portfolio
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">

        {/* Available Cash */}
        <div className="stat-card-blue rounded-2xl p-4 card-lift animate-fade-in-up delay-100">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-glow-blue p-2.5 rounded-xl">
              <DollarSign className="h-4 w-4 text-blue-300" />
            </div>
            <span className="text-[10px] font-medium text-blue-300/70 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-400/15">
              Cash
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Available Cash</p>
            {balance ? (
              <>
                <p className="text-xl font-bold text-foreground">
                  ${balance.available_cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Ready to invest</p>
              </>
            ) : (
              <div className="h-7 w-32 bg-white/5 rounded-lg animate-pulse" />
            )}
          </div>
        </div>

        {/* Portfolio Value */}
        <div className="stat-card-purple rounded-2xl p-4 card-lift animate-fade-in-up delay-200">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-glow-purple p-2.5 rounded-xl">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[10px] font-medium text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/15">
              Total
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Portfolio Value</p>
            {summary ? (
              <>
                <p className="text-xl font-bold text-foreground">
                  ${summary.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'}
                </p>
              </>
            ) : (
              <div className="h-7 w-32 bg-white/5 rounded-lg animate-pulse" />
            )}
          </div>
        </div>

        {/* Total Profit/Loss */}
        <div className="stat-card-emerald rounded-2xl p-4 card-lift animate-fade-in-up delay-300">
          <div className="flex items-start justify-between mb-3">
            <div className="icon-glow-emerald p-2.5 rounded-xl">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            {summary && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                summary.total_profit_loss >= 0
                  ? 'text-emerald-300/80 bg-emerald-500/10 border-emerald-400/20'
                  : 'text-red-300/80 bg-red-500/10 border-red-400/20'
              }`}>
                P&L
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Total P&L</p>
            {summary ? (
              <>
                <p className={`text-xl font-bold ${summary.total_profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {summary.total_profit_loss >= 0 ? '+' : ''}
                  ${summary.total_profit_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs font-medium ${summary.total_profit_loss_percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {summary.total_profit_loss_percentage >= 0 ? '+' : ''}
                  {summary.total_profit_loss_percentage.toFixed(2)}%
                </p>
              </>
            ) : (
              <div className="h-7 w-32 bg-white/5 rounded-lg animate-pulse" />
            )}
          </div>
        </div>

        {/* Trading Coach */}
        <Link href="/coach">
          <div className="stat-card-amber rounded-2xl p-4 card-lift animate-fade-in-up delay-400 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-3">
              <div className="icon-glow-amber p-2.5 rounded-xl">
                <Brain className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-[10px] font-medium text-amber-300/70 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/15">
                AI
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Trading Coach</p>
              {!coachSummary.isLoading ? (
                <>
                  <p className="text-xl font-bold text-foreground">{coachSummary.actionableSignals}</p>
                  <p className="text-xs text-muted-foreground">
                    {coachSummary.actionableSignals === 1 ? 'Signal' : 'Signals'} ready · {coachSummary.openTrades} open
                  </p>
                  {coachSummary.killSwitchActive && (
                    <p className="text-xs text-destructive font-medium">Kill switch active</p>
                  )}
                </>
              ) : (
                <div className="h-7 w-24 bg-white/5 rounded-lg animate-pulse" />
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* ── Holdings ─────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up delay-500">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Your Holdings</h2>
            <p className="text-xs text-muted-foreground">Current positions in your portfolio</p>
          </div>
          <Link href="/trade">
            <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80 hover:bg-primary/10 text-xs">
              Add position <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Glass container */}
        <div className="glass-card rounded-2xl p-4 md:p-6 card-gradient-border">
          {holdings.length === 0 ? (
            <div className="text-center py-14">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl icon-glow-purple mb-4 animate-float">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground mb-1 font-medium">No holdings yet</p>
              <p className="text-muted-foreground text-sm mb-5">Start building your portfolio</p>
              <Link href="/trade">
                <Button className="btn-shimmer text-white border-0">Start Trading</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {(() => {
                const portfolioValue = summary?.portfolio_value || 0;
                const sorted = [...holdings].sort((a, b) => (b.current_value || b.total_invested) - (a.current_value || a.total_invested));
                const groups: Record<string, typeof sorted> = {};
                const typeOrder = ['stock', 'etf', 'crypto'];
                const typeLabels: Record<string, string> = { stock: 'Stocks', etf: 'ETFs', crypto: 'Crypto' };
                for (const h of sorted) {
                  const t = h.asset_type || 'stock';
                  if (!groups[t]) groups[t] = [];
                  groups[t].push(h);
                }
                const orderedTypes = typeOrder.filter(t => groups[t]);
                for (const t of Object.keys(groups)) {
                  if (!orderedTypes.includes(t)) orderedTypes.push(t);
                }
                return orderedTypes.map((type) => {
                  const items = groups[type];
                  const groupValue = items.reduce((s, h) => s + (h.current_value || h.total_invested), 0);
                  const groupPct = portfolioValue > 0 ? (groupValue / portfolioValue) * 100 : 0;
                  return (
                    <div key={type}>
                      {/* Group header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-px w-4 bg-primary/40" />
                          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {typeLabels[type] || type}
                          </h3>
                        </div>
                        <span className="text-xs text-muted-foreground badge-glow-purple px-2 py-0.5 rounded-full">
                          {groupPct.toFixed(1)}% of portfolio
                        </span>
                      </div>

                      {/* Holdings rows */}
                      <div className="space-y-2">
                        {items.map((holding, i) => {
                          const isPriceAvailable = holding.current_price && holding.current_price > 0;
                          const holdingValue = holding.current_value || holding.total_invested;
                          const allocPct = portfolioValue > 0 ? (holdingValue / portfolioValue) * 100 : 0;
                          const isPositive = holding.unrealized_pl !== undefined && holding.unrealized_pl >= 0;
                          return (
                            <div
                              key={holding.id}
                              className={`holding-row rounded-xl p-3 animate-fade-in-up`}
                              style={{ animationDelay: `${i * 50}ms` }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {/* Symbol badge */}
                                  <div className="icon-glow-purple px-2.5 py-1 rounded-lg">
                                    <span className="text-xs font-bold text-primary">{holding.symbol}</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[140px]">
                                    {holding.asset_name}
                                  </span>
                                </div>
                                {isPriceAvailable && holding.unrealized_pl !== undefined ? (
                                  <div className={`text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                    <span className="text-sm font-semibold">
                                      {holding.unrealized_pl >= 0 ? '+' : ''}${holding.unrealized_pl.toFixed(2)}
                                    </span>
                                    <span className="text-xs ml-1.5 opacity-80">
                                      {holding.unrealized_pl_percentage !== undefined
                                        ? `${holding.unrealized_pl_percentage >= 0 ? '+' : ''}${holding.unrealized_pl_percentage.toFixed(2)}%`
                                        : '—'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">No price</span>
                                )}
                              </div>

                              {/* Progress bar */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                                  {allocPct.toFixed(1)}% alloc
                                </span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${Math.min(allocPct, 100)}%`,
                                      background: 'linear-gradient(90deg, oklch(0.58 0.26 265), oklch(0.66 0.20 245))',
                                      boxShadow: '0 0 8px oklch(0.68 0.26 265 / 40%)',
                                    }}
                                  />
                                </div>
                                {isPriceAvailable && holding.current_value && (
                                  <span className="text-xs font-semibold shrink-0 text-foreground">
                                    ${holding.current_value.toFixed(2)}
                                  </span>
                                )}
                              </div>

                              {/* Stats row */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground sm:hidden truncate mr-2">
                                  {holding.asset_name}
                                </span>
                                <div className="flex gap-3 text-[10px] text-muted-foreground ml-auto">
                                  <span>Qty: <span className="text-foreground/70">{holding.quantity}</span></span>
                                  <span>Avg: <span className="text-foreground/70">${holding.average_buy_price.toFixed(2)}</span></span>
                                  {isPriceAvailable && (
                                    <span>Now: <span className="text-foreground/70">${holding.current_price!.toFixed(2)}</span></span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Model Leaderboard ─────────────────────────────────────────────── */}
      <div className="animate-fade-in-up delay-500">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h2 className="text-base font-bold text-foreground">Model Leaderboard</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          All AI, quant, expert &amp; benchmark portfolios ranked by return.
          Click <strong>Copy</strong> to replicate any into your portfolio with one click.
        </p>

        <div className="glass-card rounded-2xl card-gradient-border overflow-hidden">
          {lbLoading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading rankings…
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No portfolios initialized yet.{' '}
              <Link href="/ai" className="text-primary underline">Start with AI Hub</Link>.
            </div>
          ) : (
            <div className="divide-y divide-white/6">
              {leaderboard.map(entry => (
                <LeaderboardRow key={entry.id} entry={entry} onCopy={setCopyTarget} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Copy Modal ────────────────────────────────────────────────────── */}
      {copyTarget && (
        <CopyModal
          entry={copyTarget}
          availableCash={balance?.available_cash ?? 0}
          onClose={() => setCopyTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['balance'] });
            qc.invalidateQueries({ queryKey: ['portfolio'] });
          }}
        />
      )}
    </div>
  );
}
