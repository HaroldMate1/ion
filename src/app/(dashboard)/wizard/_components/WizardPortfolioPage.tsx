'use client';

/**
 * Shared Wizard Portfolio Page
 * Used by both /wizard/merlin and /wizard/houdini
 */

import { toast } from 'sonner';
import {
  useWizardPortfolios,
  useWizardPortfolio,
  useInitializeWizardPortfolio,
} from '@/hooks/use-wizard-portfolios';
import { WIZARD_CONFIGS, type WizardStrategy, WIZARD_TOP_N } from '@/config/wizard-strategies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Wand2,
  Star,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  DollarSign,
  Percent,
  Play,
  PieChart,
  CheckCircle2,
  ArrowLeft,
  BarChart2,
} from 'lucide-react';
import Link from 'next/link';

const STRATEGY_META = {
  merlin: { Icon: Star, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'Magic Formula' },
  houdini: { Icon: Zap, color: 'text-violet-600', bg: 'bg-violet-50', badge: 'Enhanced' },
};

interface Props {
  strategy: WizardStrategy;
}

export default function WizardPortfolioPage({ strategy }: Props) {
  const cfg = WIZARD_CONFIGS[strategy];
  const meta = STRATEGY_META[strategy];

  const { data: portfoliosData, isLoading: listLoading } = useWizardPortfolios();
  const initializeMutation = useInitializeWizardPortfolio();

  const portfolio = (portfoliosData?.portfolios || []).find(
    (p: any) => p.strategy === strategy
  );
  const portfolioId = portfolio?.id ?? null;

  const { data: detailData, isLoading: detailLoading } = useWizardPortfolio(
    portfolio?.isInitialized ? portfolioId : null
  );

  const handleInitialize = async () => {
    try {
      const result = await initializeMutation.mutateAsync(strategy);
      if (result.success) {
        toast.success(
          `Portfolio initialized: ${result.holdingsCreated} companies bought from ${result.companiesScreened} screened`
        );
        if (result.errors?.length) {
          result.errors.forEach((e: string) => toast.warning(e));
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize portfolio');
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
    <div className="container mx-auto py-4 md:py-6 space-y-5 px-2 md:px-0">
      {/* Back link */}
      <Link
        href="/wizard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Wizard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-3 rounded-xl ${meta.bg} shrink-0`}>
          <meta.Icon className={`h-7 w-7 ${meta.color}`} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">{cfg.displayName}</h1>
            <Badge className={`text-xs ${meta.color} bg-opacity-10 border-0`} variant="outline">
              {meta.badge}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{cfg.description}</p>
        </div>
      </div>

      {!portfolio?.isInitialized ? (
        <UninitializedView cfg={cfg} meta={meta} onInitialize={handleInitialize} isPending={initializeMutation.isPending} />
      ) : (
        <InitializedView portfolio={detailData?.portfolio} isLoading={detailLoading} />
      )}
    </div>
  );
}

// ─── Uninitialized ────────────────────────────────────────────────────────────

function UninitializedView({
  cfg,
  meta,
  onInitialize,
  isPending,
}: {
  cfg: { displayName: string; title: string; description: string; methodology: string; filters: string[] };
  meta: { color: string };
  onInitialize: () => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          {cfg.title}
        </CardTitle>
        <CardDescription>{cfg.methodology}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Screening criteria</p>
          <ul className="space-y-1.5">
            {cfg.filters.map((f: string) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${meta.color}`} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
          <p><span className="font-medium">Universe:</span> ~120 large-cap US stocks across all sectors</p>
          <p><span className="font-medium">Positions:</span> Top {WIZARD_TOP_N} companies, equal-weight</p>
          <p><span className="font-medium">Starting balance:</span> $100,000 (~$3,333 per position)</p>
        </div>

        <Button onClick={onInitialize} disabled={isPending} size="lg" className="w-full md:w-auto">
          {isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Screening stocks… (this may take ~30s)
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Screener &amp; Initialize Portfolio
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Initialized ──────────────────────────────────────────────────────────────

function InitializedView({ portfolio, isLoading }: { portfolio: any; isLoading: boolean }) {
  if (isLoading || !portfolio) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const holdings = portfolio.holdings || [];
  const totalInvested = holdings.reduce((s: number, h: any) => s + h.totalInvested, 0);
  const totalValue = holdings.reduce((s: number, h: any) => s + (h.currentValue ?? h.totalInvested), 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total Value"
          value={`$${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`Cash: $${portfolio.cashBalance.toFixed(2)}`}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Invested"
          value={`$${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          icon={totalPnL >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          label="Unrealized P&L"
          value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`}
          valueClass={totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}
          sub={`${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`}
          subClass={totalPnLPct >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label="Total Return"
          value={`${portfolio.totalReturnPct >= 0 ? '+' : ''}${portfolio.totalReturnPct.toFixed(2)}%`}
          valueClass={portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}
          sub="Since inception"
        />
      </div>

      {/* Screening info */}
      {portfolio.companiesScreened && (
        <Card className="bg-muted/40">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4" />
              <span>Screened <strong className="text-foreground">{portfolio.companiesScreened}</strong> stocks</span>
            </span>
            <span>→</span>
            {portfolio.strategy === 'houdini' ? (
              <span>
                <strong className="text-foreground">{holdings.length}</strong> cleared all 19 quality gates · ranked by Magic Formula
              </span>
            ) : (
              <span>Selected top <strong className="text-foreground">{holdings.length}</strong> by Magic Formula rank</span>
            )}
            {portfolio.screeningDate && (
              <span className="ml-auto text-xs">
                Initialized on {new Date(portfolio.screeningDate).toLocaleDateString()}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Holdings ({holdings.length})
          </CardTitle>
          <CardDescription>Ranked by Magic Formula score · equal-weight allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {holdings.map((h: any) => (
              <HoldingRow key={h.id} holding={h} totalValue={portfolio.totalValue} strategy={portfolio.strategy} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
  sub,
  subClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl md:text-2xl font-bold ${valueClass ?? ''}`}>{value}</div>
        {sub && <p className={`text-xs mt-0.5 ${subClass ?? 'text-muted-foreground'}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

function HoldingRow({
  holding,
  totalValue,
  strategy,
}: {
  holding: any;
  totalValue: number;
  strategy?: string;
}) {
  const value = holding.currentValue ?? holding.totalInvested;
  const pnl = holding.unrealizedPnL ?? 0;
  const pnlPct = holding.unrealizedPnLPct ?? 0;
  const actualAlloc = totalValue > 0 ? (value / totalValue) * 100 : 0;
  const targetAlloc = holding.targetAllocationPct ?? 3.33;
  const isHoudini = strategy === 'houdini';

  return (
    <div className="p-3 border rounded-lg space-y-2">
      {/* Row 1: rank + symbol + value */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground w-6 text-right shrink-0">#{holding.magicRank}</span>
          <span className="font-semibold text-base">{holding.symbol}</span>
          <Badge variant="outline" className="text-xs shrink-0">stock</Badge>
        </div>
        <p className="font-semibold shrink-0">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Row 2: name + P&L */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground truncate mr-2">{holding.assetName || holding.symbol}</p>
        <div className="shrink-0">
          <span className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
          <span className={`text-xs ml-1 ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Row 3: allocation bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          {actualAlloc.toFixed(1)}% held
        </span>
        <Progress value={actualAlloc} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">
          Target {targetAlloc.toFixed(1)}%
        </span>
      </div>

      {/* Row 4: magic formula metrics */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {holding.peRatio != null && (
          <span>P/E <strong className="text-foreground">{holding.peRatio.toFixed(1)}</strong></span>
        )}
        {holding.earningsYield != null && (
          <span>EY <strong className="text-foreground">{(holding.earningsYield * 100).toFixed(1)}%</strong></span>
        )}
        {holding.returnOnEquity != null && (
          <span>ROE <strong className="text-foreground">{(holding.returnOnEquity * 100).toFixed(1)}%</strong></span>
        )}
        <span>@ ${holding.currentPrice?.toFixed(2) ?? holding.averageBuyPrice.toFixed(2)}</span>
      </div>

      {/* Row 5 (Houdini only): quality composite badges parsed from transaction notes */}
      {isHoudini && holding.notes && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {parseBadgesFromNotes(holding.notes).map((b) => (
            <span key={b} className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 rounded px-1.5 py-0.5 font-medium">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Extract key=value pairs from a notes string like "P/E 22.1 | ROE 45.2% | GM 68% | …" */
function parseBadgesFromNotes(notes: string): string[] {
  // Pick segments after the first two (rank + P/E already shown in row 4)
  const parts = notes.split(' | ');
  return parts.slice(2).filter(Boolean); // e.g. "GM 68%", "OpM 35%", "Piotroski 8/8"
}
