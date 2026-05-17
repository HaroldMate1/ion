/**
 * Dashboard Page
 * Main dashboard with portfolio overview
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useBalance, usePortfolio, usePortfolioSummary, useResetPortfolio } from '@/hooks/use-portfolio';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Activity, ArrowRight, Brain, RotateCcw, RefreshCw, Sparkles } from 'lucide-react';
import { useCoachSummary } from '@/hooks/use-coach';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: balance } = useBalance();
  const { holdings } = usePortfolio();
  const summary = usePortfolioSummary();
  const coachSummary = useCoachSummary();
  const resetPortfolio = useResetPortfolio();
  const [confirmReset, setConfirmReset] = useState(false);

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
    </div>
  );
}
