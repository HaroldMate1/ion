'use client';

/**
 * Fine-Tuned Model Page
 * Backtest the AI trading coach on historical data to find optimal agent weights.
 * Uses grid search across weight combinations, runs agents on past OHLC data,
 * and simulates trades to find the best risk-adjusted configuration.
 */

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUpdateCoachConfig } from '@/hooks/use-coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  FlaskConical,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
  Target,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// Default symbols to test
const PRESET_SYMBOLS = [
  { symbol: 'AAPL', assetType: 'stock' as const, market: 'us' as const, label: 'Apple' },
  { symbol: 'MSFT', assetType: 'stock' as const, market: 'us' as const, label: 'Microsoft' },
  { symbol: 'GOOGL', assetType: 'stock' as const, market: 'us' as const, label: 'Alphabet' },
  { symbol: 'AMZN', assetType: 'stock' as const, market: 'us' as const, label: 'Amazon' },
  { symbol: 'TSLA', assetType: 'stock' as const, market: 'us' as const, label: 'Tesla' },
  { symbol: 'NVDA', assetType: 'stock' as const, market: 'us' as const, label: 'NVIDIA' },
  { symbol: 'META', assetType: 'stock' as const, market: 'us' as const, label: 'Meta' },
  { symbol: 'JPM', assetType: 'stock' as const, market: 'us' as const, label: 'JPMorgan' },
  { symbol: 'SPY', assetType: 'etf' as const, market: 'us' as const, label: 'S&P 500 ETF' },
  { symbol: 'QQQ', assetType: 'etf' as const, market: 'us' as const, label: 'Nasdaq ETF' },
  { symbol: 'BTC', assetType: 'crypto' as const, market: 'us' as const, label: 'Bitcoin' },
  { symbol: 'ETH', assetType: 'crypto' as const, market: 'us' as const, label: 'Ethereum' },
];

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

interface OptimizationResult {
  results: BacktestResult[];
  aggregatedBest: { indicator: number; priceAction: number; news: number };
  aggregatedDefaultReturn: number;
  aggregatedBestReturn: number;
  improvementPct: number;
  timestamp: string;
  errors?: string[];
}

export default function FineTunePage() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(
    ['AAPL', 'MSFT', 'GOOGL', 'SPY', 'BTC']
  );
  const [lookbackDays, setLookbackDays] = useState('180');
  const [weightStep, setWeightStep] = useState('0.05');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const updateConfig = useUpdateCoachConfig();

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleRunOptimization = async () => {
    if (selectedSymbols.length === 0) {
      toast.error('Select at least one symbol');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const symbols = selectedSymbols.map(sym => {
        const preset = PRESET_SYMBOLS.find(p => p.symbol === sym);
        return preset
          ? { symbol: preset.symbol, assetType: preset.assetType, market: preset.market }
          : { symbol: sym, assetType: 'stock' as const, market: 'us' as const };
      });

      const response = await fetch('/api/coach/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          lookbackDays: parseInt(lookbackDays),
          weightStep: parseFloat(weightStep),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Optimization failed');
      }

      const data: OptimizationResult = await response.json();
      setResult(data);

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach(err => toast.warning(err));
      }

      toast.success(
        `Optimization complete! Found ${data.improvementPct >= 0 ? '+' : ''}${data.improvementPct.toFixed(1)}% improvement`
      );
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast.error(error.message || 'Failed to run optimization');
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyWeights = async () => {
    if (!result) return;

    try {
      await updateConfig.mutateAsync({
        weights: result.aggregatedBest,
      });
      toast.success('Optimized weights applied to your coach configuration!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply weights');
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coach">
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
            Backtest on historical data to find optimal agent weights for the trading coach
          </p>
        </div>
      </div>

      {/* How It Works */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-400 text-lg">1</span>
              <div>
                <p className="font-medium">Fetch History</p>
                <p className="text-muted-foreground text-xs">Get 180 days of OHLC data for each selected symbol</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-400 text-lg">2</span>
              <div>
                <p className="font-medium">Run Agents</p>
                <p className="text-muted-foreground text-xs">Run Indicator + PriceAction agents on each historical day</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-400 text-lg">3</span>
              <div>
                <p className="font-medium">Grid Search</p>
                <p className="text-muted-foreground text-xs">Test 100+ weight combinations on Nash consensus</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-400 text-lg">4</span>
              <div>
                <p className="font-medium">Find Best</p>
                <p className="text-muted-foreground text-xs">Rank by Sharpe ratio to find risk-adjusted optimal weights</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Select symbols and parameters for the backtest
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Symbol Selection */}
          <div>
            <Label className="mb-3 block">Symbols to Test</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_SYMBOLS.map(preset => (
                <button
                  key={preset.symbol}
                  onClick={() => toggleSymbol(preset.symbol)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedSymbols.includes(preset.symbol)
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-background hover:bg-accent border-border'
                  }`}
                >
                  {preset.symbol}
                  <span className="ml-1 text-xs opacity-70">
                    {preset.assetType === 'crypto' ? '₿' : preset.assetType === 'etf' ? '📊' : '📈'}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedSymbols.length} selected — more symbols = more robust weights but slower
            </p>
          </div>

          {/* Parameters */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lookback">Lookback Period</Label>
              <Select value={lookbackDays} onValueChange={setLookbackDays}>
                <SelectTrigger id="lookback">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90 days (3 months)</SelectItem>
                  <SelectItem value="180">180 days (6 months)</SelectItem>
                  <SelectItem value="365">365 days (1 year)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="step">Weight Granularity</Label>
              <Select value={weightStep} onValueChange={setWeightStep}>
                <SelectTrigger id="step">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.10">10% steps (fast, ~30 combos)</SelectItem>
                  <SelectItem value="0.05">5% steps (balanced, ~100 combos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleRunOptimization}
            disabled={isRunning || selectedSymbols.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Running Optimization... This may take 1-2 minutes
              </>
            ) : (
              <>
                <FlaskConical className="h-5 w-5 mr-2" />
                Run Backtest & Optimize Weights
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Aggregated Result */}
          <Card className="border-2 border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                Optimization Result
              </CardTitle>
              <CardDescription>
                Tested across {result.results.length} symbol{result.results.length !== 1 ? 's' : ''} — {result.timestamp && new Date(result.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Weight Comparison */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Default Weights</p>
                  <WeightBar label="Indicator" value={0.45} color="bg-blue-500" />
                  <WeightBar label="Price Action" value={0.45} color="bg-amber-500" />
                  <WeightBar label="News" value={0.10} color="bg-green-500" />
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground">Avg Return</p>
                    <p className={`text-xl font-bold ${result.aggregatedDefaultReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {result.aggregatedDefaultReturn >= 0 ? '+' : ''}{result.aggregatedDefaultReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border-2 border-purple-500/50 bg-purple-500/5">
                  <p className="text-sm font-medium text-purple-400 mb-3">
                    ✨ Optimized Weights
                  </p>
                  <WeightBar label="Indicator" value={result.aggregatedBest.indicator} color="bg-blue-500" />
                  <WeightBar label="Price Action" value={result.aggregatedBest.priceAction} color="bg-amber-500" />
                  <WeightBar label="News" value={result.aggregatedBest.news} color="bg-green-500" />
                  <div className="mt-3 pt-3 border-t border-purple-500/20">
                    <p className="text-sm text-muted-foreground">Avg Return</p>
                    <p className={`text-xl font-bold ${result.aggregatedBestReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {result.aggregatedBestReturn >= 0 ? '+' : ''}{result.aggregatedBestReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Improvement Banner */}
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
                  disabled={updateConfig.isPending}
                  className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                >
                  {updateConfig.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Apply to Coach
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Per-Symbol Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Per-Symbol Breakdown
              </CardTitle>
              <CardDescription>
                Performance comparison for each backtested symbol
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile: card layout */}
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
                        <p className="font-medium">{r.bestWeights.sharpeRatio.toFixed(2)} / {r.bestWeights.winRate.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Best weights: Ind {(r.bestWeights.weights.indicator * 100).toFixed(0)}% / PA {(r.bestWeights.weights.priceAction * 100).toFixed(0)}% / News {(r.bestWeights.weights.news * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table layout */}
              <div className="hidden md:block space-y-3">
                <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                  <div className="col-span-2">Symbol</div>
                  <div className="text-right">Default</div>
                  <div className="text-right">Optimized</div>
                  <div className="text-right">Improvement</div>
                  <div className="text-right">Sharpe</div>
                  <div className="text-right">Win Rate</div>
                  <div className="text-right">Weights</div>
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

          {/* Equity Curves (using first symbol as example) */}
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
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function WeightBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs w-24 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-sm font-mono font-medium w-12 text-right">
        {(value * 100).toFixed(0)}%
      </span>
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

  const width = 800;
  const height = 200;
  const padding = 20;

  const toPath = (curve: typeof defaultCurve) => {
    if (curve.length === 0) return '';
    return curve.map((p, i) => {
      const x = padding + (i / (curve.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((p.equity - minEquity) / range) * (height - 2 * padding);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minWidth: 400 }}>
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity={0.1} />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity={0.1} />

        {/* $100k baseline */}
        {(() => {
          const y = height - padding - ((100000 - minEquity) / range) * (height - 2 * padding);
          return (
            <line
              x1={padding} y1={y} x2={width - padding} y2={y}
              stroke="currentColor" opacity={0.2} strokeDasharray="4 4"
            />
          );
        })()}

        {/* Default curve */}
        <path d={toPath(defaultCurve)} fill="none" stroke="#6b7280" strokeWidth={2} opacity={0.6} />

        {/* Optimized curve */}
        <path d={toPath(optimizedCurve)} fill="none" stroke="#a855f7" strokeWidth={2.5} />

        {/* Legend */}
        <line x1={width - 200} y1={15} x2={width - 180} y2={15} stroke="#6b7280" strokeWidth={2} opacity={0.6} />
        <text x={width - 175} y={19} fill="currentColor" fontSize={11} opacity={0.6}>Default</text>
        <line x1={width - 110} y1={15} x2={width - 90} y2={15} stroke="#a855f7" strokeWidth={2.5} />
        <text x={width - 85} y={19} fill="#a855f7" fontSize={11}>Optimized</text>

        {/* Y-axis labels */}
        <text x={padding - 5} y={padding + 5} fill="currentColor" fontSize={10} textAnchor="end" opacity={0.5}>
          ${(maxEquity / 1000).toFixed(0)}k
        </text>
        <text x={padding - 5} y={height - padding + 5} fill="currentColor" fontSize={10} textAnchor="end" opacity={0.5}>
          ${(minEquity / 1000).toFixed(0)}k
        </text>
      </svg>
    </div>
  );
}
