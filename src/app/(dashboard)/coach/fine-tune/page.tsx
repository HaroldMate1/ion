'use client';

/**
 * Fine-Tuned Model Page — Pharma Specialization
 * Backtest the AI trading coach on pharma/biotech historical data to find optimal
 * agent weights, then apply those weights to an independent $100,000 Fine-Tune
 * portfolio that trades pharma stocks completely separately from the Coach.
 */

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useFineTuneConfig,
  useFineTuneBalance,
  useFineTuneTrades,
  useApplyFineTuneWeights,
  useRunFineTuneAnalysis,
  useResetFineTune,
} from '@/hooks/use-fine-tune-portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  FileText,
  FlaskConical,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
  Target,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Play,
  DollarSign,
  Percent,
} from 'lucide-react';

// ── Pharma / Biotech universe (55 companies — US + International ADRs) ────────
const PRESET_SYMBOLS = [
  // ── US Large-Cap Pharma ─────────────────────────────────────────────────────
  { symbol: 'JNJ',   assetType: 'stock' as const, market: 'us' as const, label: 'Johnson & Johnson' },
  { symbol: 'PFE',   assetType: 'stock' as const, market: 'us' as const, label: 'Pfizer' },
  { symbol: 'MRK',   assetType: 'stock' as const, market: 'us' as const, label: 'Merck' },
  { symbol: 'ABBV',  assetType: 'stock' as const, market: 'us' as const, label: 'AbbVie' },
  { symbol: 'LLY',   assetType: 'stock' as const, market: 'us' as const, label: 'Eli Lilly' },
  { symbol: 'BMY',   assetType: 'stock' as const, market: 'us' as const, label: 'Bristol-Myers Squibb' },
  { symbol: 'TMO',   assetType: 'stock' as const, market: 'us' as const, label: 'Thermo Fisher' },
  { symbol: 'ABT',   assetType: 'stock' as const, market: 'us' as const, label: 'Abbott Labs' },
  { symbol: 'DHR',   assetType: 'stock' as const, market: 'us' as const, label: 'Danaher' },
  { symbol: 'SYK',   assetType: 'stock' as const, market: 'us' as const, label: 'Stryker' },
  { symbol: 'BDX',   assetType: 'stock' as const, market: 'us' as const, label: 'Becton Dickinson' },
  { symbol: 'ZTS',   assetType: 'stock' as const, market: 'us' as const, label: 'Zoetis' },
  { symbol: 'BAX',   assetType: 'stock' as const, market: 'us' as const, label: 'Baxter Intl' },
  { symbol: 'VTRS',  assetType: 'stock' as const, market: 'us' as const, label: 'Viatris (Generics)' },
  // ── US Biotech ──────────────────────────────────────────────────────────────
  { symbol: 'AMGN',  assetType: 'stock' as const, market: 'us' as const, label: 'Amgen' },
  { symbol: 'GILD',  assetType: 'stock' as const, market: 'us' as const, label: 'Gilead Sciences' },
  { symbol: 'REGN',  assetType: 'stock' as const, market: 'us' as const, label: 'Regeneron' },
  { symbol: 'VRTX',  assetType: 'stock' as const, market: 'us' as const, label: 'Vertex Pharma' },
  { symbol: 'BIIB',  assetType: 'stock' as const, market: 'us' as const, label: 'Biogen' },
  { symbol: 'MRNA',  assetType: 'stock' as const, market: 'us' as const, label: 'Moderna' },
  { symbol: 'BNTX',  assetType: 'stock' as const, market: 'us' as const, label: 'BioNTech' },
  { symbol: 'INCY',  assetType: 'stock' as const, market: 'us' as const, label: 'Incyte' },
  { symbol: 'ALNY',  assetType: 'stock' as const, market: 'us' as const, label: 'Alnylam' },
  { symbol: 'BMRN',  assetType: 'stock' as const, market: 'us' as const, label: 'BioMarin' },
  { symbol: 'SGEN',  assetType: 'stock' as const, market: 'us' as const, label: 'Seagen' },
  { symbol: 'EXEL',  assetType: 'stock' as const, market: 'us' as const, label: 'Exelixis' },
  { symbol: 'HALO',  assetType: 'stock' as const, market: 'us' as const, label: 'Halozyme' },
  { symbol: 'UTHR',  assetType: 'stock' as const, market: 'us' as const, label: 'United Therapeutics' },
  { symbol: 'NBIX',  assetType: 'stock' as const, market: 'us' as const, label: 'Neurocrine Bio' },
  { symbol: 'PCVX',  assetType: 'stock' as const, market: 'us' as const, label: 'Vaxcyte' },
  { symbol: 'SRPT',  assetType: 'stock' as const, market: 'us' as const, label: 'Sarepta Therapeutics' },
  { symbol: 'RARE',  assetType: 'stock' as const, market: 'us' as const, label: 'Ultragenyx' },
  { symbol: 'IONS',  assetType: 'stock' as const, market: 'us' as const, label: 'Ionis Pharma' },
  { symbol: 'PTCT',  assetType: 'stock' as const, market: 'us' as const, label: 'PTC Therapeutics' },
  { symbol: 'INSM',  assetType: 'stock' as const, market: 'us' as const, label: 'Insmed' },
  { symbol: 'MEDP',  assetType: 'stock' as const, market: 'us' as const, label: 'Medpace (CRO)' },
  // ── International Pharma (US-listed ADRs) ───────────────────────────────────
  { symbol: 'AZN',   assetType: 'stock' as const, market: 'us' as const, label: 'AstraZeneca (UK)' },
  { symbol: 'NVO',   assetType: 'stock' as const, market: 'us' as const, label: 'Novo Nordisk (DK)' },
  { symbol: 'GSK',   assetType: 'stock' as const, market: 'us' as const, label: 'GSK (UK)' },
  { symbol: 'SNY',   assetType: 'stock' as const, market: 'us' as const, label: 'Sanofi (FR)' },
  { symbol: 'NVS',   assetType: 'stock' as const, market: 'us' as const, label: 'Novartis (CH)' },
  { symbol: 'RHHBY', assetType: 'stock' as const, market: 'us' as const, label: 'Roche (CH)' },
  { symbol: 'BAYRY', assetType: 'stock' as const, market: 'us' as const, label: 'Bayer (DE)' },
  { symbol: 'TAK',   assetType: 'stock' as const, market: 'us' as const, label: 'Takeda (JP)' },
  { symbol: 'ARGX',  assetType: 'stock' as const, market: 'us' as const, label: 'argenx (NL)' },
  { symbol: 'HLN',   assetType: 'stock' as const, market: 'us' as const, label: 'Haleon (UK)' },
  { symbol: 'ZLAB',  assetType: 'stock' as const, market: 'us' as const, label: 'Zai Lab (CN)' },
  { symbol: 'RDY',   assetType: 'stock' as const, market: 'us' as const, label: "Dr. Reddy's (IN)" },
  { symbol: 'TEVA',  assetType: 'stock' as const, market: 'us' as const, label: 'Teva Pharma (IL)' },
  { symbol: 'ALVO',  assetType: 'stock' as const, market: 'us' as const, label: 'Alvotech (IS)' },
  { symbol: 'LEGN',  assetType: 'stock' as const, market: 'us' as const, label: 'Legend Biotech (CN)' },
  { symbol: 'BHC',   assetType: 'stock' as const, market: 'us' as const, label: 'Bausch Health (CA)' },
  { symbol: 'CTLT',  assetType: 'stock' as const, market: 'us' as const, label: 'Catalent (CDMO)' },
  { symbol: 'IQV',   assetType: 'stock' as const, market: 'us' as const, label: 'IQVIA (CRO)' },
  { symbol: 'CRL',   assetType: 'stock' as const, market: 'us' as const, label: 'Charles River Labs' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeightResult {
  weights: { indicator: number; priceAction: number; news: number };
  totalReturn: number;
  totalReturnPct: number;
  trades: number;
  wins: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  equityCurve: Array<{ date: number; equity: number }>;
}

interface BacktestResult {
  symbol: string;
  assetType: string;
  totalBars: number;
  signalBars: number;
  bestWeights: WeightResult;
  defaultWeights: WeightResult;
  improvement: number;
  allResults: WeightResult[];
}

interface OptimizationResult {
  results: BacktestResult[];
  aggregatedBest: { indicator: number; priceAction: number; news: number };
  aggregatedDefaultReturn: number;
  aggregatedBestReturn: number;
  improvementPct: number;
  timestamp: string;
  errors?: string[];
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FineTunePage() {
  const [lookbackDays, setLookbackDays] = useState('365');
  const [weightStep, setWeightStep]     = useState('0.05');
  const [isRunning, setIsRunning]       = useState(false);
  const [result, setResult]             = useState<OptimizationResult | null>(null);

  // Portfolio hooks
  const { data: config }              = useFineTuneConfig();
  const { data: balance, isLoading: balanceLoading } = useFineTuneBalance();
  const { data: tradesData }          = useFineTuneTrades();
  const applyWeights                  = useApplyFineTuneWeights();
  const runAnalysis                   = useRunFineTuneAnalysis();
  const resetFineTune                 = useResetFineTune();
  const trades: any[]                 = tradesData?.trades || [];
  const [confirmReset, setConfirmReset] = useState(false);

  const handleRunOptimization = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const symbols = PRESET_SYMBOLS.map(p => ({
        symbol: p.symbol, assetType: p.assetType, market: p.market,
      }));
      const response = await fetch('/api/coach/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, lookbackDays: parseInt(lookbackDays), weightStep: parseFloat(weightStep) }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Optimization failed');
      }
      const data: OptimizationResult = await response.json();
      setResult(data);
      if (data.errors?.length) data.errors.forEach(err => toast.warning(err));
      toast.success(`Optimization complete! ${data.improvementPct >= 0 ? '+' : ''}${data.improvementPct.toFixed(1)}% improvement found`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to run optimization');
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyWeights = async () => {
    if (!result) return;
    try {
      await applyWeights.mutateAsync(result.aggregatedBest);
      toast.success('Optimized weights applied to Fine-Tune portfolio!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply weights');
    }
  };

  const handleResetFineTune = async () => {
    try {
      await resetFineTune.mutateAsync();
      setConfirmReset(false);
      toast.success('Fine-Tune portfolio reset. You can now apply new weights.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset portfolio');
    }
  };

  const handleRunAnalysis = async () => {
    try {
      const data = await runAnalysis.mutateAsync();
      toast.success(
        `Analysis complete: ${data.tradesExecuted} trade(s) executed across ${data.signalsGenerated} signals`
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to run analysis');
    }
  };

  const ret = balance?.totalReturnPct ?? 0;

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/ai">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FlaskConical className="h-6 w-6 text-purple-500 shrink-0" />
            <h1 className="text-xl sm:text-3xl font-bold">Fine-Tuned Model</h1>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30" variant="outline">
              Experimental
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pharma-specialized: backtests all {PRESET_SYMBOLS.length} pharma & biotech stocks, then runs an independent $100k portfolio — separate from the Coach
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Link href="/coach/fine-tune/reports">
          <Button variant="outline" size="sm" className="text-xs border-purple-500/30 hover:bg-purple-500/10">
            <FileText className="h-4 w-4 mr-1.5 shrink-0 text-purple-500" />
            <span className="text-purple-400">Reports</span>
          </Button>
        </Link>
      </div>

      {/* ── Fine-Tune Portfolio Dashboard ────────────────────────────────── */}
      <Card className="border-purple-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-500" />
            Fine-Tune Portfolio
            {(balance?.openPositions ?? 0) > 0 && (
              <Badge variant="outline" className="text-blue-500 border-blue-300">
                {balance.openPositions} open
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Independent $100,000 paper portfolio — trades using your fine-tuned weights, never affects the Coach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {balanceLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Total Value
                  </p>
                  <p className="text-lg font-bold">
                    ${(balance?.totalValue ?? 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Available Cash
                  </p>
                  <p className="text-lg font-bold">
                    ${(balance?.availableCash ?? 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Total Return
                  </p>
                  <p className={`text-lg font-bold ${ret >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Open Positions</p>
                  <p className="text-lg font-bold">{balance?.openPositions ?? 0}</p>
                </div>
              </div>

              {/* Active weights */}
              {config?.isActive && (
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Active weights:</span>
                  <span>Indicator <strong>{((config.weights.indicator ?? 0.45) * 100).toFixed(0)}%</strong></span>
                  <span>Price Action <strong>{((config.weights.priceAction ?? 0.45) * 100).toFixed(0)}%</strong></span>
                  <span>News <strong>{((config.weights.news ?? 0.10) * 100).toFixed(0)}%</strong></span>
                  {config.lastAppliedAt && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Applied {new Date(config.lastAppliedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              {!config?.isActive && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Run a backtest below and apply the optimized weights to activate the portfolio.
                </p>
              )}

              {/* Run Analysis button */}
              <Button
                onClick={handleRunAnalysis}
                disabled={runAnalysis.isPending || !config?.isActive}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {runAnalysis.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Running Analysis…</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Run Live Analysis</>
                )}
              </Button>

              {/* Restart */}
              <div className="flex justify-end pt-1">
                {confirmReset ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Reset all trades and start fresh?</span>
                    <Button size="sm" variant="destructive" onClick={handleResetFineTune} disabled={resetFineTune.isPending}>
                      {resetFineTune.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, reset'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setConfirmReset(true)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restart Portfolio
                  </Button>
                )}
              </div>

              {/* Recent trades */}
              {trades.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recent Trades ({balance?.totalTrades ?? 0} total)</p>
                  <div className="space-y-1.5">
                    {trades.slice(0, 6).map((t: any) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant={t.side === 'BUY' ? 'default' : 'destructive'}
                            className="text-[10px] shrink-0"
                          >
                            {t.side}
                          </Badge>
                          <span className="font-semibold">{t.symbol}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            ${Number(t.size_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          {t.status === 'open' ? (
                            <Badge variant="outline" className="text-blue-500 text-[10px]">Open</Badge>
                          ) : (
                            <span className={`font-medium text-sm ${Number(t.pnl_usd) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {Number(t.pnl_usd) >= 0 ? '+' : ''}${Number(t.pnl_usd || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-4 text-sm">
            {[
              { n: 1, title: 'Fetch History', desc: `Get up to 5 years of OHLC data for all ${PRESET_SYMBOLS.length} pharma/biotech stocks` },
              { n: 2, title: 'Run Agents', desc: 'Run Indicator + PriceAction agents on each historical day' },
              { n: 3, title: 'Grid Search', desc: 'Test 100+ weight combinations on Nash consensus' },
              { n: 4, title: 'Apply & Trade', desc: 'Apply optimal weights to your Fine-Tune portfolio — Coach stays unchanged' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex items-start gap-2">
                <span className="font-bold text-purple-400 text-lg">{n}</span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-muted-foreground text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Configuration ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Backtest Configuration</CardTitle>
          <CardDescription>Configure parameters for the {PRESET_SYMBOLS.length}-stock pharma/biotech optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Universe overview — compact list of all 55 companies */}
          <div>
            <Label className="mb-2 block">Pharma & Biotech Universe ({PRESET_SYMBOLS.length} companies)</Label>
            <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground max-h-40 overflow-y-auto">
              <div className="columns-2 sm:columns-3 gap-x-4">
                {PRESET_SYMBOLS.map(p => (
                  <p key={p.symbol} className="break-inside-avoid py-0.5">
                    <span className="font-semibold text-foreground">{p.symbol}</span>{' '}
                    <span className="opacity-80">{p.label}</span>
                  </p>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              All {PRESET_SYMBOLS.length} stocks are backtested — broader universe = more robust weights
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lookback">Lookback Period</Label>
              <Select value={lookbackDays} onValueChange={setLookbackDays}>
                <SelectTrigger id="lookback"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90 days — 3 months (fast)</SelectItem>
                  <SelectItem value="180">180 days — 6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="730">2 years</SelectItem>
                  <SelectItem value="1095">3 years</SelectItem>
                  <SelectItem value="1825">5 years (slow, most robust)</SelectItem>
                </SelectContent>
              </Select>
              {parseInt(lookbackDays) >= 1095 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Long periods may take 3–5+ minutes to compute
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="step">Weight Granularity</Label>
              <Select value={weightStep} onValueChange={setWeightStep}>
                <SelectTrigger id="step"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.10">10% steps (fast, ~30 combos)</SelectItem>
                  <SelectItem value="0.05">5% steps (balanced, ~100 combos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleRunOptimization}
            disabled={isRunning}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {isRunning ? (
              <><RefreshCw className="h-5 w-5 mr-2 animate-spin" />Running Optimization… (1-2 min)</>
            ) : (
              <><FlaskConical className="h-5 w-5 mr-2" />Run Backtest & Optimize Weights</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && (
        <>
          <Card className="border-2 border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                Optimization Result
              </CardTitle>
              <CardDescription>
                Tested across {result.results.length} symbol{result.results.length !== 1 ? 's' : ''} —{' '}
                {result.timestamp && new Date(result.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Weight comparison */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Default Weights</p>
                  <WeightBar label="Indicator"    value={0.45} color="bg-blue-500" />
                  <WeightBar label="Price Action" value={0.45} color="bg-amber-500" />
                  <WeightBar label="News"         value={0.10} color="bg-green-500" />
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground">Avg Return</p>
                    <p className={`text-xl font-bold ${result.aggregatedDefaultReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {result.aggregatedDefaultReturn >= 0 ? '+' : ''}{result.aggregatedDefaultReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border-2 border-purple-500/50 bg-purple-500/5">
                  <p className="text-sm font-medium text-purple-400 mb-3">✨ Optimized Weights</p>
                  <WeightBar label="Indicator"    value={result.aggregatedBest.indicator}   color="bg-blue-500" />
                  <WeightBar label="Price Action" value={result.aggregatedBest.priceAction} color="bg-amber-500" />
                  <WeightBar label="News"         value={result.aggregatedBest.news}        color="bg-green-500" />
                  <div className="mt-3 pt-3 border-t border-purple-500/20">
                    <p className="text-sm text-muted-foreground">Avg Return</p>
                    <p className={`text-xl font-bold ${result.aggregatedBestReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {result.aggregatedBestReturn >= 0 ? '+' : ''}{result.aggregatedBestReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply banner */}
              <div className={`p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                result.improvementPct >= 0
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-yellow-500/10 border border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  {result.improvementPct >= 0 ? (
                    <TrendingUp className="h-6 w-6 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {result.improvementPct >= 0
                        ? `+${result.improvementPct.toFixed(2)}% improvement over defaults`
                        : `${result.improvementPct.toFixed(2)}% — default weights are already near-optimal`
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Based on {parseInt(lookbackDays)}-day backtest across {result.results.length} symbols
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleApplyWeights}
                  disabled={applyWeights.isPending}
                  className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto shrink-0"
                >
                  {applyWeights.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Apply to Fine-Tune Portfolio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Per-symbol breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Per-Symbol Breakdown
              </CardTitle>
              <CardDescription>Performance comparison for each backtested symbol</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile */}
              <div className="space-y-3 md:hidden">
                {result.results.map((r) => (
                  <div key={r.symbol} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.symbol}</span>
                        <Badge variant="secondary" className="text-[10px]">{r.assetType}</Badge>
                      </div>
                      <span className={`text-sm font-bold ${r.improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {r.improvement >= 0 ? '+' : ''}{r.improvement.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Default</p>
                        <p className={`font-medium ${r.defaultWeights.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {r.defaultWeights.totalReturnPct >= 0 ? '+' : ''}{r.defaultWeights.totalReturnPct.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Optimized</p>
                        <p className={`font-medium ${r.bestWeights.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {r.bestWeights.totalReturnPct >= 0 ? '+' : ''}{r.bestWeights.totalReturnPct.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sharpe / Win%</p>
                        <p className="font-medium">
                          {r.bestWeights.sharpeRatio.toFixed(2)} / {r.bestWeights.winRate.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Best: Ind {(r.bestWeights.weights.indicator * 100).toFixed(0)}% / PA {(r.bestWeights.weights.priceAction * 100).toFixed(0)}% / News {(r.bestWeights.weights.news * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block space-y-3">
                <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                  <div className="col-span-2">Symbol</div>
                  <div className="text-right">Default</div>
                  <div className="text-right">Optimized</div>
                  <div className="text-right">Improvement</div>
                  <div className="text-right">Sharpe</div>
                  <div className="text-right">Win Rate</div>
                  <div className="text-right">Weights (I/PA/N)</div>
                </div>
                {result.results.map((r) => (
                  <div
                    key={r.symbol}
                    className="grid grid-cols-8 gap-2 items-center p-2 rounded-lg hover:bg-muted/50 text-sm"
                  >
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="font-semibold">{r.symbol}</span>
                      <Badge variant="secondary" className="text-[10px]">{r.assetType}</Badge>
                    </div>
                    <div className={`text-right font-medium ${r.defaultWeights.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {r.defaultWeights.totalReturnPct >= 0 ? '+' : ''}{r.defaultWeights.totalReturnPct.toFixed(1)}%
                    </div>
                    <div className={`text-right font-medium ${r.bestWeights.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {r.bestWeights.totalReturnPct >= 0 ? '+' : ''}{r.bestWeights.totalReturnPct.toFixed(1)}%
                    </div>
                    <div className={`text-right font-medium ${r.improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {r.improvement >= 0 ? '+' : ''}{r.improvement.toFixed(1)}%
                    </div>
                    <div className="text-right">{r.bestWeights.sharpeRatio.toFixed(2)}</div>
                    <div className="text-right">{r.bestWeights.winRate.toFixed(0)}%</div>
                    <div className="text-right text-xs text-muted-foreground">
                      {(r.bestWeights.weights.indicator * 100).toFixed(0)}/
                      {(r.bestWeights.weights.priceAction * 100).toFixed(0)}/
                      {(r.bestWeights.weights.news * 100).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Equity curve */}
          {result.results.length > 0 && result.results[0].bestWeights.equityCurve.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Equity Curve — {result.results[0].symbol}</CardTitle>
                <CardDescription>
                  Portfolio value over time: Default weights vs Optimized weights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MiniEquityCurve
                  defaultCurve={result.results[0].defaultWeights.equityCurve}
                  optimizedCurve={result.results[0].bestWeights.equityCurve}
                />
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {result.errors && result.errors.length > 0 && (
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WeightBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs w-24 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-sm font-mono font-medium w-12 text-right">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function MiniEquityCurve({
  defaultCurve,
  optimizedCurve,
}: {
  defaultCurve: Array<{ date: number; equity: number }>;
  optimizedCurve: Array<{ date: number; equity: number }>;
}) {
  if (optimizedCurve.length === 0) return null;

  const allEquities = [...defaultCurve, ...optimizedCurve].map(p => p.equity);
  const minEquity = Math.min(...allEquities);
  const maxEquity = Math.max(...allEquities);
  const range = maxEquity - minEquity || 1;
  const W = 800, H = 200, P = 20;

  const toPath = (curve: typeof defaultCurve) =>
    curve.length === 0 ? '' : curve.map((p, i) => {
      const x = P + (i / (curve.length - 1)) * (W - 2 * P);
      const y = H - P - ((p.equity - minEquity) / range) * (H - 2 * P);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

  const baselineY = H - P - ((100000 - minEquity) / range) * (H - 2 * P);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: 400 }}>
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="currentColor" opacity={0.1} />
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="currentColor" opacity={0.1} />
        <line x1={P} y1={baselineY} x2={W - P} y2={baselineY} stroke="currentColor" opacity={0.2} strokeDasharray="4 4" />
        <path d={toPath(defaultCurve)}   fill="none" stroke="#6b7280" strokeWidth={2} opacity={0.6} />
        <path d={toPath(optimizedCurve)} fill="none" stroke="#a855f7" strokeWidth={2.5} />
        <line x1={W - 200} y1={15} x2={W - 180} y2={15} stroke="#6b7280" strokeWidth={2} opacity={0.6} />
        <text x={W - 175} y={19} fill="currentColor" fontSize={11} opacity={0.6}>Default</text>
        <line x1={W - 110} y1={15} x2={W - 90}  y2={15} stroke="#a855f7" strokeWidth={2.5} />
        <text x={W - 85}  y={19} fill="#a855f7"  fontSize={11}>Optimized</text>
        <text x={P - 5} y={P + 5}      fill="currentColor" fontSize={10} textAnchor="end" opacity={0.5}>${(maxEquity / 1000).toFixed(0)}k</text>
        <text x={P - 5} y={H - P + 5}  fill="currentColor" fontSize={10} textAnchor="end" opacity={0.5}>${(minEquity / 1000).toFixed(0)}k</text>
      </svg>
    </div>
  );
}
