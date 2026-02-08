'use client';

/**
 * Expert Investors Page
 * Track and compare portfolios of the world's top investors
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useExpertPortfolios,
  useExpertPortfolio,
  useInitializeExpertPortfolio,
} from '@/hooks/use-expert-portfolios';
import { INVESTOR_SLUGS, type InvestorSlug } from '@/config/expert-investors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Crown,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  PieChart,
  Play,
  DollarSign,
  Percent,
  Calendar,
  Database,
  User,
} from 'lucide-react';

const INVESTOR_COLORS: Record<InvestorSlug, string> = {
  buffett: 'bg-blue-600',
  marks: 'bg-slate-600',
  smith: 'bg-teal-600',
  druckenmiller: 'bg-violet-600',
  greenblatt: 'bg-indigo-600',
  dalio: 'bg-emerald-600',
  hempton: 'bg-cyan-600',
  asness: 'bg-rose-600',
  burry: 'bg-amber-600',
  pabrai: 'bg-orange-600',
};

const INVESTOR_INITIALS: Record<InvestorSlug, string> = {
  buffett: 'WB',
  marks: 'HM',
  smith: 'TS',
  druckenmiller: 'SD',
  greenblatt: 'JG',
  dalio: 'RD',
  hempton: 'JH',
  asness: 'CA',
  burry: 'MB',
  pabrai: 'MP',
};

export default function ExpertInvestorsPage() {
  const [activeTab, setActiveTab] = useState<InvestorSlug>('buffett');
  const { data: portfoliosData, isLoading: listLoading } = useExpertPortfolios();
  const initializePortfolio = useInitializeExpertPortfolio();

  const portfolios = portfoliosData?.portfolios || [];
  const selectedPortfolio = portfolios.find(p => p.investorSlug === activeTab);
  const selectedPortfolioId = selectedPortfolio?.id || null;

  const { data: detailData, isLoading: detailLoading } = useExpertPortfolio(
    selectedPortfolio?.isInitialized ? selectedPortfolioId : null
  );

  const handleInitialize = async (slug: InvestorSlug) => {
    try {
      const result = await initializePortfolio.mutateAsync(slug);
      if (result.success) {
        toast.success(`Portfolio initialized with ${result.holdingsCreated} holdings`);
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((err: string) => toast.warning(err));
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize portfolio');
    }
  };

  if (listLoading) {
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
          <Crown className="h-8 w-8" />
          Expert Investors
        </h1>
        <p className="text-muted-foreground">
          Track portfolios of the world&apos;s top investors with $100,000 simulated portfolios. Prices update live.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {portfolios.map((portfolio) => (
          <Card
            key={portfolio.investorSlug}
            className={`cursor-pointer transition-all ${
              activeTab === portfolio.investorSlug ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab(portfolio.investorSlug)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full ${INVESTOR_COLORS[portfolio.investorSlug]} flex items-center justify-center text-white text-xs font-bold`}>
                  {INVESTOR_INITIALS[portfolio.investorSlug]}
                </div>
                <div>
                  <CardTitle className="text-sm">{portfolio.displayName}</CardTitle>
                  <p className="text-[10px] text-muted-foreground leading-tight">{portfolio.title}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {portfolio.isInitialized ? (
                <>
                  <div className="text-xl font-bold">
                    ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className={`text-sm ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
                  </p>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-muted-foreground">$100,000</div>
                  <p className="text-sm text-muted-foreground">Not initialized</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InvestorSlug)}>
        <TabsList className="grid grid-cols-5 md:grid-cols-10 w-full">
          {INVESTOR_SLUGS.map((slug) => {
            const portfolio = portfolios.find(p => p.investorSlug === slug);
            return (
              <TabsTrigger key={slug} value={slug} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${INVESTOR_COLORS[slug]}`} />
                <span className="hidden sm:inline">{portfolio?.displayName || slug}</span>
                <span className="sm:hidden">{INVESTOR_INITIALS[slug]}</span>
                {portfolio?.isInitialized && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1">Live</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {INVESTOR_SLUGS.map((slug) => {
          const portfolio = portfolios.find(p => p.investorSlug === slug);

          return (
            <TabsContent key={slug} value={slug} className="space-y-4 mt-4">
              {!portfolio?.isInitialized ? (
                <UninitializedCard
                  portfolio={portfolio}
                  slug={slug}
                  onInitialize={handleInitialize}
                  isPending={initializePortfolio.isPending}
                />
              ) : (
                <InvestorPortfolioDetail
                  portfolio={detailData?.portfolio}
                  isLoading={detailLoading}
                  color={INVESTOR_COLORS[slug]}
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function UninitializedCard({
  portfolio,
  slug,
  onInitialize,
  isPending,
}: {
  portfolio: any;
  slug: InvestorSlug;
  onInitialize: (slug: InvestorSlug) => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full ${INVESTOR_COLORS[slug]} flex items-center justify-center text-white text-xs font-bold`}>
            {INVESTOR_INITIALS[slug]}
          </div>
          {portfolio?.fullName}
        </CardTitle>
        <CardDescription>{portfolio?.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{portfolio?.description}</p>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <PieChart className="h-4 w-4" />
            <span className="font-medium">Strategy:</span> {portfolio?.strategy}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            <span className="font-medium">Data Source:</span> {portfolio?.dataSource}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Last Filing:</span> {portfolio?.lastUpdated}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Initialize to simulate a $100,000 portfolio matching {portfolio?.displayName}&apos;s latest disclosed positions.
            Prices update in real-time.
          </p>
        </div>
        <Button onClick={() => onInitialize(slug)} disabled={isPending}>
          {isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Initialize Portfolio
        </Button>
      </CardContent>
    </Card>
  );
}

function InvestorPortfolioDetail({
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
      {/* Investor Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-bold`}>
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{portfolio.fullName}</h2>
              <p className="text-sm text-muted-foreground">{portfolio.title}</p>
              <p className="text-sm mt-1">{portfolio.description}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Database className="h-3 w-3" />
                {portfolio.dataSource}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                Last updated: {portfolio.lastUpdated}
              </div>
              <Badge variant="outline" className="mt-1 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Prices update every 60s
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
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
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <Percent className="h-4 w-4" />
              Total Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Since inception</p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Holdings ({holdings.length})
          </CardTitle>
          <CardDescription>
            {portfolio.strategy}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {holdings.map((holding: any) => (
              <InvestorHoldingRow
                key={holding.id}
                holding={holding}
                totalValue={totalValue}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InvestorHoldingRow({ holding, totalValue }: { holding: any; totalValue: number }) {
  const value = holding.currentValue || holding.totalInvested;
  const pnl = holding.unrealizedPnL || 0;
  const pnlPct = holding.unrealizedPnLPct || 0;
  const actualAlloc = totalValue > 0 ? (value / totalValue) * 100 : 0;

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{holding.symbol}</span>
          <Badge variant="outline" className="text-xs">{holding.assetType}</Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">{holding.assetName}</p>
      </div>

      <div className="text-right hidden sm:block">
        <p className="text-sm text-muted-foreground">Target</p>
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
