'use client';

/**
 * Benchmark Indexes Page
 * Track S&P 500 (SPY) and NASDAQ 100 (QQQ) with full $100k in each ETF
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useBenchmarkPortfolios, useInitializeBenchmark } from '@/hooks/use-benchmarks';
import { BENCHMARK_SLUGS, BENCHMARKS, type BenchmarkSlug } from '@/config/benchmark-indexes';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, TrendingDown, RefreshCw, Wallet,
  PieChart, Play, DollarSign, Hash, Info, ArrowUpDown, Sparkles,
} from 'lucide-react';

export default function BenchmarksPage() {
  const [activeTab, setActiveTab] = useState<BenchmarkSlug>('sp500');
  const { data, isLoading } = useBenchmarkPortfolios();
  const initBenchmark = useInitializeBenchmark();
  const portfolios = data?.portfolios || [];

  const handleInitialize = async (slug: BenchmarkSlug) => {
    try {
      const result = await initBenchmark.mutateAsync(slug);
      if (result.success) {
        toast.success(
          `${BENCHMARKS[slug].displayName} initialized: ${result.sharesOwned.toFixed(4)} shares of ${BENCHMARKS[slug].etfSymbol} at $${result.currentPrice.toFixed(2)}`
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize benchmark');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full border border-primary/30 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6 space-y-6 px-1 md:px-0">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <div className="icon-glow-blue p-2 rounded-xl">
            <BarChart3 className="h-5 w-5 text-blue-300" />
          </div>
          <Sparkles className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
            Market Indexes
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">Benchmark Indexes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track how $100,000 performs in major market indexes via ETFs. Each ETF holds ALL stocks in the index. Prices update live.
        </p>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 animate-fade-in-up delay-100">
        {portfolios.map((portfolio: any, i: number) => (
          <button
            key={portfolio.slug}
            onClick={() => setActiveTab(portfolio.slug)}
            className={`
              text-left rounded-2xl p-5 transition-all duration-250 card-lift
              ${activeTab === portfolio.slug
                ? 'glass-card border-primary/30 shadow-[0_0_24px_oklch(0.68_0.26_265/18%)]'
                : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }
            `}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl ${portfolio.color} flex items-center justify-center text-white font-bold text-xs shadow-lg`}>
                  {portfolio.etfSymbol}
                </div>
                <div>
                  <p className="font-bold text-base">{portfolio.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {portfolio.totalStocks} stocks via {portfolio.etfSymbol}
                  </p>
                </div>
              </div>
              {portfolio.isInitialized && (
                <span className="badge-glow-emerald text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5" /> Live
                </span>
              )}
            </div>
            {portfolio.isInitialized ? (
              <>
                <p className="text-3xl font-bold">
                  ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-base font-semibold mt-0.5 ${portfolio.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
                  <span className="text-sm font-normal ml-1.5 text-muted-foreground">
                    ({portfolio.totalReturnPct >= 0 ? '+' : ''}${(portfolio.totalValue - 100000).toFixed(2)})
                  </span>
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-muted-foreground">$100,000</p>
                <p className="text-sm text-muted-foreground mt-0.5">Not initialized</p>
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Comparison Card ───────────────────────────────────────────────── */}
      {portfolios.filter((p: any) => p.isInitialized).length === 2 && (
        <ComparisonCard portfolios={portfolios} />
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up delay-200">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BenchmarkSlug)}>
          <TabsList className="grid grid-cols-2 w-full max-w-sm bg-white/[0.04] rounded-xl p-1">
            {BENCHMARK_SLUGS.map((slug) => (
              <TabsTrigger key={slug} value={slug} className="rounded-lg flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <div className={`w-2 h-2 rounded-full ${BENCHMARKS[slug].color}`} />
                {BENCHMARKS[slug].displayName}
              </TabsTrigger>
            ))}
          </TabsList>

          {BENCHMARK_SLUGS.map((slug) => {
            const portfolio = portfolios.find((p: any) => p.slug === slug);
            const bench = BENCHMARKS[slug];
            return (
              <TabsContent key={slug} value={slug} className="mt-5">
                {!portfolio?.isInitialized ? (
                  <UninitializedView bench={bench} slug={slug} onInitialize={handleInitialize} isPending={initBenchmark.isPending} />
                ) : (
                  <InitializedView portfolio={portfolio} bench={bench} />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

function UninitializedView({ bench, slug, onInitialize, isPending }: {
  bench: any; slug: BenchmarkSlug; onInitialize: (slug: BenchmarkSlug) => void; isPending: boolean;
}) {
  return (
    <div className="glass-card card-gradient-border rounded-2xl p-5 animate-scale-in space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-2xl ${bench.color} flex items-center justify-center text-white font-bold text-xs shadow-lg`}>
          {bench.etfSymbol[0]}
        </div>
        <div>
          <h2 className="text-base font-bold">{bench.fullName}</h2>
          <p className="text-xs text-muted-foreground">{bench.description}</p>
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm font-medium">
            Investing $100,000 into {bench.etfSymbol} gives you exposure to all {bench.totalStocks} stocks:
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {bench.topComponents.map((comp: string, i: number) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              comp.startsWith('+') ? 'badge-glow-purple' : 'badge-glow-blue'
            }`}>
              {comp}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Expense ratio: {bench.expenseRatio}</p>
      </div>
      <Button onClick={() => onInitialize(slug)} disabled={isPending} className="btn-shimmer text-white border-0">
        {isPending
          ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Initializing...</>
          : <><Play className="h-4 w-4 mr-2" />Invest $100,000 in {bench.etfSymbol}</>}
      </Button>
    </div>
  );
}

function InitializedView({ portfolio, bench }: { portfolio: any; bench: any }) {
  const holding = portfolio.holdings?.[0];
  if (!holding) return null;

  const pnl    = portfolio.totalValue - 100000;
  const pnlPct = portfolio.totalReturnPct;

  return (
    <div className="space-y-4 animate-fade-in-up">

      {/* ETF info */}
      <div className="glass-card card-gradient-border rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${bench.color} flex items-center justify-center text-white font-bold shadow-lg`}>
            {bench.etfSymbol}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{bench.fullName}</h2>
            <p className="text-sm text-muted-foreground">{holding.assetName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contains all {bench.totalStocks} stocks · Expense ratio: {bench.expenseRatio}
            </p>
          </div>
          <span className="badge-glow-emerald text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" /> Live
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="stat-card-purple rounded-2xl p-4 card-lift">
          <div className="icon-glow-purple p-2 rounded-xl w-fit mb-3"><Wallet className="h-4 w-4 text-primary" /></div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Portfolio Value</p>
          <p className="text-xl font-bold mt-0.5">
            ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="stat-card-blue rounded-2xl p-4 card-lift">
          <div className="icon-glow-blue p-2 rounded-xl w-fit mb-3"><DollarSign className="h-4 w-4 text-blue-300" /></div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Price</p>
          <p className="text-xl font-bold mt-0.5">${holding.currentPrice?.toFixed(2) || '---'}</p>
          <p className="text-xs text-muted-foreground">Bought at ${holding.averageBuyPrice?.toFixed(2) || '---'}</p>
        </div>
        <div className="stat-card-emerald rounded-2xl p-4 card-lift">
          <div className="icon-glow-emerald p-2 rounded-xl w-fit mb-3">
            {pnl >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Profit / Loss</p>
          <p className={`text-xl font-bold mt-0.5 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </p>
          <p className={`text-xs font-medium ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
        <div className="stat-card-amber rounded-2xl p-4 card-lift">
          <div className="icon-glow-amber p-2 rounded-xl w-fit mb-3"><Hash className="h-4 w-4 text-amber-400" /></div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Shares Owned</p>
          <p className="text-xl font-bold mt-0.5">{holding.quantity?.toFixed(4) || '0'}</p>
          <p className="text-xs text-muted-foreground">{bench.etfSymbol}</p>
        </div>
      </div>

      {/* What's Inside */}
      <div className="glass-card card-gradient-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="icon-glow-purple p-1.5 rounded-lg"><PieChart className="h-4 w-4 text-primary" /></div>
          <div>
            <h3 className="text-sm font-bold">What&apos;s Inside {bench.etfSymbol} ({bench.totalStocks} stocks)</h3>
            <p className="text-xs text-muted-foreground">Each share gives you proportional ownership of all these stocks</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {bench.topComponents.map((comp: string, i: number) => (
            <span key={i} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
              comp.startsWith('+') ? 'badge-glow-purple' : 'badge-glow-blue'
            }`}>
              {comp}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({ portfolios }: { portfolios: any[] }) {
  const sp500  = portfolios.find((p: any) => p.slug === 'sp500');
  const nasdaq = portfolios.find((p: any) => p.slug === 'nasdaq100');
  if (!sp500 || !nasdaq) return null;

  const spReturn     = sp500.totalReturnPct;
  const nasdaqReturn = nasdaq.totalReturnPct;
  const leader       = spReturn > nasdaqReturn ? sp500 : nasdaq;
  const diff         = Math.abs(spReturn - nasdaqReturn);

  return (
    <div className="glass-card card-gradient-border rounded-2xl p-5 animate-fade-in-up delay-150">
      <div className="flex items-center gap-2 mb-4">
        <div className="icon-glow-purple p-1.5 rounded-lg"><ArrowUpDown className="h-4 w-4 text-primary" /></div>
        <h2 className="text-sm font-bold">SPY vs QQQ — Head to Head</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="text-center">
          <div className={`w-10 h-10 rounded-2xl ${sp500.color} mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
            SPY
          </div>
          <p className="text-sm font-semibold">S&P 500</p>
          <p className={`text-2xl font-bold mt-0.5 ${spReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {spReturn >= 0 ? '+' : ''}{spReturn.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground">
            ${sp500.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Difference</p>
          <p className="text-2xl font-bold gradient-text-primary">{diff.toFixed(2)}%</p>
          <span className="badge-glow-purple text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mt-1">
            {leader.displayName} leads
          </span>
        </div>
        <div className="text-center">
          <div className={`w-10 h-10 rounded-2xl ${nasdaq.color} mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
            QQQ
          </div>
          <p className="text-sm font-semibold">NASDAQ 100</p>
          <p className={`text-2xl font-bold mt-0.5 ${nasdaqReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {nasdaqReturn >= 0 ? '+' : ''}{nasdaqReturn.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground">
            ${nasdaq.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
