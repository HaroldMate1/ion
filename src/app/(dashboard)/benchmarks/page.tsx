'use client';

/**
 * Benchmark Indexes Page
 * Track S&P 500 and NASDAQ 100 with individual stock holdings
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useBenchmarkPortfolios,
  useBenchmarkPortfolio,
  useInitializeBenchmark,
} from '@/hooks/use-benchmarks';
import { BENCHMARK_SLUGS, BENCHMARKS, type BenchmarkSlug } from '@/config/benchmark-indexes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';

export default function BenchmarksPage() {
  const [activeTab, setActiveTab] = useState<BenchmarkSlug>('sp500');
  const { data, isLoading } = useBenchmarkPortfolios();
  const initBenchmark = useInitializeBenchmark();

  const portfolios = data?.portfolios || [];
  const selectedPortfolio = portfolios.find((p: any) => p.slug === activeTab);
  const selectedPortfolioId = selectedPortfolio?.id || null;

  const { data: detailData, isLoading: detailLoading } = useBenchmarkPortfolio(
    selectedPortfolio?.isInitialized ? selectedPortfolioId : null
  );

  const handleInitialize = async (slug: BenchmarkSlug) => {
    try {
      const result = await initBenchmark.mutateAsync(slug);
      if (result.success) {
        toast.success(`${result.portfolio.displayName} initialized with ${result.holdingsCreated} stocks`);
        if (result.errors?.length) {
          result.errors.forEach((err: string) => toast.warning(err));
        }
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
          Track how $100,000 performs in major market indexes with individual stock holdings. Prices update live.
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
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${portfolio.color}`} />
                  <CardTitle className="text-lg">{portfolio.displayName}</CardTitle>
                </div>
                {portfolio.isInitialized && (
                  <Badge variant="secondary">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {portfolio.totalStocks} stocks | Top 20 holdings tracked
              </CardDescription>
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

      {/* Comparison (when both initialized) */}
      {portfolios.filter((p: any) => p.isInitialized).length === 2 && (
        <ComparisonCard portfolios={portfolios} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BenchmarkSlug)}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          {BENCHMARK_SLUGS.map((slug) => {
            const portfolio = portfolios.find((p: any) => p.slug === slug);
            return (
              <TabsTrigger key={slug} value={slug} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${BENCHMARKS[slug].color}`} />
                {BENCHMARKS[slug].displayName}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {BENCHMARK_SLUGS.map((slug) => {
          const portfolio = portfolios.find((p: any) => p.slug === slug);
          const bench = BENCHMARKS[slug];

          return (
            <TabsContent key={slug} value={slug} className="mt-4">
              {!portfolio?.isInitialized ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${bench.color}`} />
                      {bench.fullName}
                    </CardTitle>
                    <CardDescription>{bench.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <p className="font-medium">Top 20 Holdings:</p>
                      <div className="flex flex-wrap gap-2">
                        {bench.holdings.map((h) => (
                          <Badge key={h.symbol} variant="outline" className="text-xs">
                            {h.symbol} ({h.allocationPct}%)
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Initialize to invest $100,000 across these {bench.holdings.length} stocks
                        matching the {bench.displayName} index weights. Remaining funds stay as cash
                        (representing the other {bench.totalStocks - bench.holdings.length} smaller holdings).
                      </p>
                    </div>
                    <Button onClick={() => handleInitialize(slug)} disabled={initBenchmark.isPending}>
                      {initBenchmark.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Initialize {bench.displayName} Portfolio
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <BenchmarkDetail
                  portfolio={detailData?.portfolio}
                  isLoading={detailLoading}
                  color={bench.color}
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
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
          Head-to-Head Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="text-center">
            <div className={`w-3 h-3 rounded-full ${sp500.color} mx-auto mb-1`} />
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
            <div className={`w-3 h-3 rounded-full ${nasdaq.color} mx-auto mb-1`} />
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

function BenchmarkDetail({
  portfolio,
  isLoading,
  color,
}: {
  portfolio: any;
  isLoading: boolean;
  color: string;
}) {
  if (isLoading || !portfolio) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const holdings = portfolio.holdings || [];
  const totalInvested = holdings.reduce((sum: number, h: any) => sum + h.totalInvested, 0);
  const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || h.totalInvested), 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-bold text-xs`}>
              {portfolio.displayName?.split(' ').map((w: string) => w[0]).join('')}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{portfolio.fullName}</h2>
              <p className="text-sm text-muted-foreground">{portfolio.description}</p>
            </div>
            <Badge variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" />
              Updates every 60s
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
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalValue + portfolio.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Cash: ${portfolio.cashBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Invested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Unrealized P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
            <p className={`text-sm ${totalPnLPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Holdings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{holdings.length}</div>
            <p className="text-xs text-muted-foreground">
              Top stocks from {portfolio.totalStocks} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Holdings ({holdings.length})
          </CardTitle>
          <CardDescription>
            Top {holdings.length} stocks by index weight
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {holdings.map((holding: any) => (
              <HoldingRow
                key={holding.id}
                holding={holding}
                totalValue={totalValue + portfolio.cashBalance}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HoldingRow({ holding, totalValue }: { holding: any; totalValue: number }) {
  const value = holding.currentValue || holding.totalInvested;
  const pnl = holding.unrealizedPnL || 0;
  const pnlPct = holding.unrealizedPnLPct || 0;
  const actualAlloc = totalValue > 0 ? (value / totalValue) * 100 : 0;

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{holding.symbol}</span>
        </div>
        <p className="text-sm text-muted-foreground truncate">{holding.assetName}</p>
      </div>

      <div className="text-right hidden sm:block">
        <p className="text-sm text-muted-foreground">Weight</p>
        <p className="font-medium">{holding.targetAllocationPct.toFixed(1)}%</p>
      </div>

      <div className="w-24 hidden md:block">
        <p className="text-xs text-muted-foreground mb-1">Actual: {actualAlloc.toFixed(1)}%</p>
        <Progress value={actualAlloc} className="h-2" />
      </div>

      <div className="text-right min-w-[100px]">
        <p className="font-medium">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-muted-foreground">
          {holding.quantity.toFixed(4)} @ ${holding.currentPrice?.toFixed(2) || holding.averageBuyPrice.toFixed(2)}
        </p>
      </div>

      <div className="text-right min-w-[90px]">
        <p className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
        </p>
        <p className={`text-sm ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
