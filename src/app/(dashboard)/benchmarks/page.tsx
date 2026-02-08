'use client';

/**
 * Benchmark Indexes Page
 * Track S&P 500 and NASDAQ 100 performance with $100k each
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useBenchmarkPortfolios, useInitializeBenchmark } from '@/hooks/use-benchmarks';
import { BENCHMARK_SLUGS, type BenchmarkSlug } from '@/config/benchmark-indexes';
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
  DollarSign,
  Percent,
  Play,
  Hash,
  ArrowUpDown,
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
        toast.success(`${result.portfolio.displayName} initialized at $${result.portfolio.currentPrice?.toFixed(2)}/share`);
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
          Track how $100,000 performs in major market indexes. Prices update live every 60 seconds.
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
                <Badge variant="outline" className="text-xs">
                  {portfolio.symbol}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {portfolio.isInitialized ? (
                <div className="flex items-end justify-between">
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
                  <Badge variant="secondary">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
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

      {/* Comparison Table (if both initialized) */}
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
                <div className={`w-2 h-2 rounded-full ${portfolio?.color || 'bg-gray-400'}`} />
                {portfolio?.displayName || slug}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {BENCHMARK_SLUGS.map((slug) => {
          const portfolio = portfolios.find((p: any) => p.slug === slug);
          return (
            <TabsContent key={slug} value={slug} className="mt-4">
              {!portfolio?.isInitialized ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${portfolio?.color}`} />
                      {portfolio?.fullName}
                    </CardTitle>
                    <CardDescription>{portfolio?.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Initialize to invest $100,000 into <strong>{portfolio?.symbol}</strong> ({portfolio?.displayName} ETF).
                        The portfolio will track the index performance in real-time.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleInitialize(slug)}
                      disabled={initBenchmark.isPending}
                    >
                      {initBenchmark.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Initialize ${(100000).toLocaleString()} into {portfolio?.symbol}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <BenchmarkDetail portfolio={portfolio} />
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
            <Badge variant="outline" className="text-xs">
              {leader.displayName} leads
            </Badge>
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

function BenchmarkDetail({ portfolio }: { portfolio: any }) {
  const pnl = portfolio.totalValue - 100000;
  const pnlPct = portfolio.totalReturnPct;

  return (
    <div className="space-y-4">
      {/* Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${portfolio.color} flex items-center justify-center text-white font-bold text-sm`}>
              {portfolio.symbol}
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
              Current Value
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
              Price per Share
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolio.currentPrice?.toFixed(2) || portfolio.averageBuyPrice.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Bought at ${portfolio.averageBuyPrice.toFixed(2)}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Since inception</p>
          </CardContent>
        </Card>
      </div>

      {/* Position Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Position Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Shares Held</p>
              <p className="text-lg font-semibold">{portfolio.quantity.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Buy Price</p>
              <p className="text-lg font-semibold">${portfolio.averageBuyPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-lg font-semibold">${portfolio.currentPrice?.toFixed(2) || '---'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invested</p>
              <p className="text-lg font-semibold">${portfolio.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
