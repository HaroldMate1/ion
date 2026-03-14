'use client';

/**
 * LLM Portfolios Page
 * Compare investment strategies from 5 different LLM models
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  useLLMPortfolios,
  useLLMPortfolio,
  useInitializeLLMPortfolio,
  useResetLLMPortfolio,
} from '@/hooks/use-llm-portfolios';
import { LLM_PROVIDERS, type LLMProvider } from '@/config/llm-allocations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Bot,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  PieChart,
  Play,
  DollarSign,
  Percent,
  CalendarClock,
  Timer,
  AlertTriangle,
  Activity,
  LineChart,
  RotateCcw,
} from 'lucide-react';
import { TradingDashboard } from '@/components/llm/trading-dashboard';

// Horizon helpers
const HORIZON_YEARS = 4;

function getHorizonInfo(createdAt: string | null) {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  const horizon = new Date(start);
  horizon.setFullYear(horizon.getFullYear() + HORIZON_YEARS);
  const now = new Date();
  const msRemaining = horizon.getTime() - now.getTime();
  const isDue = msRemaining <= 0;

  if (isDue) {
    return { start, horizon, isDue: true as const, label: 'Review due', remaining: '' };
  }

  const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remaining =
    years > 0
      ? `${years}y ${months}m remaining`
      : months > 0
        ? `${months}m ${days % 30}d remaining`
        : `${days}d remaining`;

  return { start, horizon, isDue: false as const, label: remaining, remaining };
}

// LLM Provider Icons/Colors
const LLM_COLORS: Record<string, string> = {
  gemini: 'bg-blue-500',
  claude: 'bg-orange-500',
  perplexity: 'bg-purple-500',
  chatgpt: 'bg-green-500',
  grok: 'bg-red-500',
  'gemini-trading': 'bg-blue-600',
  'claude-trading': 'bg-orange-600',
  'chatgpt-trading': 'bg-green-600',
};

type ViewMode = 'investing' | 'trading';

export default function LLMPortfoliosPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('investing');
  const [activeTab, setActiveTab] = useState<string>('gemini');
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const { data: portfoliosData, isLoading: listLoading } = useLLMPortfolios();
  const initializePortfolio = useInitializeLLMPortfolio();
  const resetPortfolio = useResetLLMPortfolio();

  useEffect(() => {
    // Reset active tab when switching modes
    if (viewMode === 'investing') {
      setActiveTab('gemini');
    } else {
      setActiveTab('gemini-trading');
    }
  }, [viewMode]);

  const allPortfolios = portfoliosData?.portfolios || [];
  
  // Filter portfolios based on mode
  const portfolios = allPortfolios.filter(p => {
    if (viewMode === 'investing') {
      return !p.provider.endsWith('-trading');
    }
    return p.provider.endsWith('-trading');
  });

  const providers = portfolios.map(p => p.provider);
  // Ensure activeTab is valid for current mode
  const effectiveActiveTab = providers.includes(activeTab as LLMProvider) ? activeTab : providers[0];

  // Get the currently selected portfolio
  const selectedPortfolio = portfolios.find(p => p.provider === effectiveActiveTab);
  const selectedPortfolioId = selectedPortfolio?.id || null;

  // Fetch detailed portfolio data if initialized
  const { data: detailData, isLoading: detailLoading } = useLLMPortfolio(
    selectedPortfolio?.isInitialized ? selectedPortfolioId : null
  );

  const handleInitialize = async (provider: LLMProvider) => {
    try {
      const result = await initializePortfolio.mutateAsync(provider);
      if (result.success) {
        toast.success(`${provider} portfolio initialized`);
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((err: string) => toast.warning(err));
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize portfolio');
    }
  };

  const handleReset = async (id: string) => {
    try {
      await resetPortfolio.mutateAsync(id);
      toast.success('Portfolio reset — you can now re-initialize it');
      setConfirmResetId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset portfolio');
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
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 md:h-8 md:w-8" />
            LLM Portfolios
          </h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'investing' 
              ? `Compare investment strategies from 5 AI models · ${HORIZON_YEARS}-year horizon`
              : 'Active daily trading based on LLM signals · 100% Cash Start'
            }
          </p>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-[300px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="investing" className="flex gap-2">
              <LineChart className="h-4 w-4" /> Investing
            </TabsTrigger>
            <TabsTrigger value="trading" className="flex gap-2">
              <Activity className="h-4 w-4" /> Trading
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-3 grid-cols-2 lg:grid-cols-${portfolios.length}`}>
        {portfolios.map((portfolio) => (
          <Card
            key={portfolio.provider}
            className={`cursor-pointer transition-all ${
              effectiveActiveTab === portfolio.provider ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab(portfolio.provider)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${LLM_COLORS[portfolio.provider]}`} />
                <CardTitle className="text-sm">{portfolio.displayName}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {portfolio.isInitialized ? (
                <>
                  <div className="text-lg md:text-2xl font-bold truncate">
                    ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className={`text-xs md:text-sm ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg md:text-2xl font-bold text-muted-foreground">$100k</div>
                  <p className="text-xs md:text-sm text-muted-foreground">Not initialized</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs for Each LLM */}
      <Tabs value={effectiveActiveTab} onValueChange={(v) => setActiveTab(v)} className="w-full">


        {portfolios.map((portfolio) => (
          <TabsContent key={portfolio.provider} value={portfolio.provider} className="space-y-4 mt-4">
            {!portfolio.isInitialized ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${LLM_COLORS[portfolio.provider]}`} />
                    {portfolio?.displayName || portfolio.provider} Portfolio
                  </CardTitle>
                  <CardDescription>
                    {portfolio.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium mb-2">Strategy: {portfolio.strategy}</p>
                    <p className="text-sm text-muted-foreground">
                      Initialize this portfolio to {viewMode === 'investing' ? 'auto-buy assets' : 'start trading'} according to {portfolio.displayName}&apos;s strategy. 
                      Starting balance: $100,000.
                    </p>
                  </div>
                  <Button
                    onClick={() => handleInitialize(portfolio.provider)}
                    disabled={initializePortfolio.isPending}
                  >
                    {initializePortfolio.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Initialize Portfolio
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Restart bar */}
                <div className="flex justify-end">
                  {confirmResetId === portfolio.id ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Reset all data and start fresh?</span>
                      <Button size="sm" variant="destructive" onClick={() => handleReset(portfolio.id)} disabled={resetPortfolio.isPending}>
                        {resetPortfolio.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, reset'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmResetId(null)} disabled={resetPortfolio.isPending}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirmResetId(portfolio.id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Restart Portfolio
                    </Button>
                  )}
                </div>
                {viewMode === 'trading' ? (
                  <TradingDashboard
                    portfolio={detailData?.portfolio}
                    isLoading={detailLoading}
                    color={LLM_COLORS[portfolio.provider]}
                  />
                ) : (
                  <PortfolioDetail
                    portfolio={detailData?.portfolio}
                    isLoading={detailLoading}
                    color={LLM_COLORS[portfolio.provider]}
                  />
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface PortfolioDetailProps {
  portfolio: any;
  isLoading: boolean;
  color: string;
}

function PortfolioDetail({ portfolio, isLoading, color }: PortfolioDetailProps) {
  if (isLoading || !portfolio) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const holdings = portfolio.holdings || [];

  // Calculate totals
  const totalInvested = holdings.reduce((sum: number, h: any) => sum + h.totalInvested, 0);
  const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || h.totalInvested), 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Group by asset type
  const assetGroups: Record<string, any[]> = {};
  holdings.forEach((h: any) => {
    const type = h.assetType;
    if (!assetGroups[type]) assetGroups[type] = [];
    assetGroups[type].push(h);
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
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

      {/* Strategy Info + Horizon */}
      {(() => {
        const horizonInfo = getHorizonInfo(portfolio.createdAt);
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                {portfolio.displayName}&apos;s Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">{portfolio.description}</p>
              <p className="font-medium">{portfolio.strategy}</p>

              {horizonInfo && (
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  horizonInfo.isDue
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border bg-muted/40'
                }`}>
                  {horizonInfo.isDue ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  ) : (
                    <CalendarClock className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {HORIZON_YEARS}-Year Horizon
                      </span>
                      <Badge variant={horizonInfo.isDue ? 'destructive' : 'secondary'} className="text-xs">
                        {horizonInfo.isDue ? (
                          <><AlertTriangle className="h-3 w-3 mr-1" /> Review Due</>
                        ) : (
                          <><Timer className="h-3 w-3 mr-1" /> {horizonInfo.label}</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Started {horizonInfo.start.toLocaleDateString()} · Ends {horizonInfo.horizon.toLocaleDateString()}
                    </p>
                    {horizonInfo.isDue && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Re-prompt {portfolio.displayName} for an updated allocation and re-initialize this portfolio.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Holdings ({holdings.length})
          </CardTitle>
          <CardDescription>
            Current positions and their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(assetGroups).map(([type, items]) => (
              <div key={type}>
                <h3 className="font-semibold mb-3 capitalize">{type}s</h3>
                <div className="space-y-2">
                  {items.map((holding: any) => (
                    <HoldingRow key={holding.id} holding={holding} totalValue={totalValue} />
                  ))}
                </div>
              </div>
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
    <div className="p-3 border rounded-lg space-y-2">
      {/* Row 1: Symbol + Value */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-base">{holding.symbol}</span>
          <Badge variant="outline" className="text-xs shrink-0">{holding.assetType}</Badge>
        </div>
        <p className="font-semibold shrink-0">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      {/* Row 2: Name + P&L */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground truncate mr-2">{holding.assetName}</p>
        <div className="shrink-0">
          <span className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
          <span className={`text-xs ml-1 ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>
      {/* Row 3: Allocation bar - prominent */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-24 shrink-0">
          {actualAlloc.toFixed(1)}% of portfolio
        </span>
        <Progress value={actualAlloc} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">
          Target: {holding.targetAllocationPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
