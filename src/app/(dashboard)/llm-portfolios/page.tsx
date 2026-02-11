'use client';

/**
 * LLM Portfolios Page
 * Compare investment strategies from 5 different LLM models
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useLLMPortfolios,
  useLLMPortfolio,
  useInitializeLLMPortfolio,
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
} from 'lucide-react';

// LLM Provider Icons/Colors
const LLM_COLORS: Record<LLMProvider, string> = {
  gemini: 'bg-blue-500',
  claude: 'bg-orange-500',
  perplexity: 'bg-purple-500',
  chatgpt: 'bg-green-500',
  grok: 'bg-red-500',
};

export default function LLMPortfoliosPage() {
  const [activeTab, setActiveTab] = useState<LLMProvider>('gemini');
  const { data: portfoliosData, isLoading: listLoading } = useLLMPortfolios();
  const initializePortfolio = useInitializeLLMPortfolio();

  const portfolios = portfoliosData?.portfolios || [];

  // Get the currently selected portfolio
  const selectedPortfolio = portfolios.find(p => p.provider === activeTab);
  const selectedPortfolioId = selectedPortfolio?.id || null;

  // Fetch detailed portfolio data if initialized
  const { data: detailData, isLoading: detailLoading } = useLLMPortfolio(
    selectedPortfolio?.isInitialized ? selectedPortfolioId : null
  );

  const handleInitialize = async (provider: LLMProvider) => {
    try {
      const result = await initializePortfolio.mutateAsync(provider);
      if (result.success) {
        toast.success(`${provider} portfolio initialized with ${result.holdingsCreated} holdings`);
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
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 md:h-8 md:w-8" />
          LLM Portfolios
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare investment strategies from 5 AI models, each starting with $100,000
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {portfolios.map((portfolio) => (
          <Card
            key={portfolio.provider}
            className={`cursor-pointer transition-all ${
              activeTab === portfolio.provider ? 'ring-2 ring-primary' : ''
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LLMProvider)}>
        <TabsList className="grid grid-cols-5 w-full h-auto">
          {LLM_PROVIDERS.map((provider) => {
            const portfolio = portfolios.find(p => p.provider === provider);
            return (
              <TabsTrigger key={provider} value={provider} className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 py-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${LLM_COLORS[provider]}`} />
                <span className="truncate">{portfolio?.displayName || provider}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {LLM_PROVIDERS.map((provider) => {
          const portfolio = portfolios.find(p => p.provider === provider);

          return (
            <TabsContent key={provider} value={provider} className="space-y-4 mt-4">
              {!portfolio?.isInitialized ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${LLM_COLORS[provider]}`} />
                      {portfolio?.displayName || provider} Portfolio
                    </CardTitle>
                    <CardDescription>
                      {portfolio?.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="font-medium mb-2">Strategy: {portfolio?.strategy}</p>
                      <p className="text-sm text-muted-foreground">
                        Initialize this portfolio to auto-buy assets according to {portfolio?.displayName}&apos;s
                        recommended allocation. Starting balance: $100,000.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleInitialize(provider)}
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
                <PortfolioDetail
                  portfolio={detailData?.portfolio}
                  isLoading={detailLoading}
                  color={LLM_COLORS[provider]}
                />
              )}
            </TabsContent>
          );
        })}
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

      {/* Strategy Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            {portfolio.displayName}&apos;s Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{portfolio.description}</p>
          <p className="font-medium mt-2">{portfolio.strategy}</p>
        </CardContent>
      </Card>

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
      {/* Row 1: Symbol + P&L */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium">{holding.symbol}</span>
          <Badge variant="outline" className="text-xs shrink-0">{holding.assetType}</Badge>
        </div>
        <div className="text-right">
          <p className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </p>
          <p className={`text-xs ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
      </div>
      {/* Row 2: Name + Value */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground truncate mr-2">{holding.assetName}</p>
        <p className="font-medium shrink-0">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      {/* Row 3: Allocation bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="shrink-0">Target: {holding.targetAllocationPct.toFixed(1)}%</span>
        <Progress value={actualAlloc} className="h-1.5 flex-1" />
        <span className="shrink-0">{actualAlloc.toFixed(1)}%</span>
      </div>
    </div>
  );
}
