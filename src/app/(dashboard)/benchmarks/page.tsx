'use client';

/**
 * Benchmark Indexes Page
 * Track S&P 500 (SPY) and NASDAQ 100 (QQQ) with full $100k in each ETF
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useBenchmarkPortfolios, useInitializeBenchmark } from '@/hooks/use-benchmarks';
import { BENCHMARK_SLUGS, BENCHMARKS, type BenchmarkSlug } from '@/config/benchmark-indexes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  PieChart,
  Play,
  DollarSign,
  Percent,
  ArrowUpDown,
  Hash,
  Info,
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
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
          Benchmark Indexes
        </h1>
        <p className="text-muted-foreground">
          Track how $100,000 performs in major market indexes via ETFs. Each ETF holds ALL stocks in the index. Prices update live.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {portfolios.map((portfolio: any) => (
          <Card
            key={portfolio.slug}
            className={`cursor-pointer transition-all ${
              activeTab === portfolio.slug ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab(portfolio.slug)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${portfolio.color} flex items-center justify-center text-white font-bold text-sm`}>
                    {portfolio.etfSymbol}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{portfolio.displayName}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {portfolio.totalStocks} stocks via {portfolio.etfSymbol}
                    </p>
                  </div>
                </div>
                {portfolio.isInitialized && (
                  <Badge variant="secondary">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {portfolio.isInitialized ? (
                <div>
                  <div className="text-3xl font-bold">
                    ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-lg font-semibold ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
                    <span className="text-sm font-normal ml-1">
                      ({portfolio.totalReturnPct >= 0 ? '+' : ''}${(portfolio.totalValue - 100000).toFixed(2)})
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl font-bold text-muted-foreground">$100,000</div>
                  <p className="text-sm text-muted-foreground">Not initialized</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison */}
      {portfolios.filter((p: any) => p.isInitialized).length === 2 && (
        <ComparisonCard portfolios={portfolios} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BenchmarkSlug)}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          {BENCHMARK_SLUGS.map((slug) => (
            <TabsTrigger key={slug} value={slug} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${BENCHMARKS[slug].color}`} />
              {BENCHMARKS[slug].displayName}
            </TabsTrigger>
          ))}
        </TabsList>

        {BENCHMARK_SLUGS.map((slug) => {
          const portfolio = portfolios.find((p: any) => p.slug === slug);
          const bench = BENCHMARKS[slug];

          return (
            <TabsContent key={slug} value={slug} className="mt-4">
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
  );
}

function UninitializedView({
  bench,
  slug,
  onInitialize,
  isPending,
}: {
  bench: any;
  slug: BenchmarkSlug;
  onInitialize: (slug: BenchmarkSlug) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${bench.color} flex items-center justify-center text-white text-xs font-bold`}>
              {bench.etfSymbol[0]}
            </div>
            {bench.fullName}
          </CardTitle>
          <CardDescription>{bench.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Investing $100,000 into {bench.etfSymbol} gives you exposure to all {bench.totalStocks} stocks:
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bench.topComponents.map((comp: string, i: number) => (
                <Badge
                  key={i}
                  variant={comp.startsWith('+') ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {comp}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Expense ratio: {bench.expenseRatio}
            </p>
          </div>
          <Button onClick={() => onInitialize(slug)} disabled={isPending}>
            {isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Invest $100,000 in {bench.etfSymbol}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InitializedView({ portfolio, bench }: { portfolio: any; bench: any }) {
  const holding = portfolio.holdings?.[0];
  if (!holding) return null;

  const pnl = portfolio.totalValue - 100000;
  const pnlPct = portfolio.totalReturnPct;

  return (
    <div className="space-y-4">
      {/* ETF Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full ${bench.color} flex items-center justify-center text-white font-bold`}>
              {bench.etfSymbol}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{bench.fullName}</h2>
              <p className="text-sm text-muted-foreground">{holding.assetName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contains all {bench.totalStocks} stocks | Expense ratio: {bench.expenseRatio}
              </p>
            </div>
            <Badge variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" />
              Live updates
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Portfolio Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Current Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${holding.currentPrice?.toFixed(2) || '---'}
            </div>
            <p className="text-xs text-muted-foreground">
              Bought at ${holding.averageBuyPrice.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {pnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Profit / Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </div>
            <p className={`text-sm ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Shares Owned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{holding.quantity.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">{bench.etfSymbol}</p>
          </CardContent>
        </Card>
      </div>

      {/* What's Inside */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            What&apos;s Inside {bench.etfSymbol} ({bench.totalStocks} stocks)
          </CardTitle>
          <CardDescription>
            Each share of {bench.etfSymbol} gives you proportional ownership of all these stocks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {bench.topComponents.map((comp: string, i: number) => (
              <Badge
                key={i}
                variant={comp.startsWith('+') ? 'secondary' : 'outline'}
                className={`text-sm py-1.5 px-3 ${comp.startsWith('+') ? '' : 'font-medium'}`}
              >
                {comp}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonCard({ portfolios }: { portfolios: any[] }) {
  const sp500 = portfolios.find((p: any) => p.slug === 'sp500');
  const nasdaq = portfolios.find((p: any) => p.slug === 'nasdaq100');
  if (!sp500 || !nasdaq) return null;

  const spReturn = sp500.totalReturnPct;
  const nasdaqReturn = nasdaq.totalReturnPct;
  const leader = spReturn > nasdaqReturn ? sp500 : nasdaq;
  const diff = Math.abs(spReturn - nasdaqReturn);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          SPY vs QQQ
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="text-center">
            <div className={`w-8 h-8 rounded-full ${sp500.color} mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold`}>
              SPY
            </div>
            <p className="text-sm font-medium">S&P 500</p>
            <p className={`text-xl font-bold ${spReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {spReturn >= 0 ? '+' : ''}{spReturn.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground">
              ${sp500.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Difference</p>
            <p className="text-lg font-bold">{diff.toFixed(2)}%</p>
            <Badge variant="outline" className="text-xs">{leader.displayName} leads</Badge>
          </div>
          <div className="text-center">
            <div className={`w-8 h-8 rounded-full ${nasdaq.color} mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold`}>
              QQQ
            </div>
            <p className="text-sm font-medium">NASDAQ 100</p>
            <p className={`text-xl font-bold ${nasdaqReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {nasdaqReturn >= 0 ? '+' : ''}{nasdaqReturn.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground">
              ${nasdaq.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
