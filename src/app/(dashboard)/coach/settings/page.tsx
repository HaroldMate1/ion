'use client';

/**
 * Coach Settings Page
 * Configure coach parameters, watchlist, and risk settings
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCoachConfig, useUpdateCoachConfig } from '@/hooks/use-coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function CoachSettingsPage() {
  const { data: config, isLoading } = useCoachConfig();
  const updateConfig = useUpdateCoachConfig();

  // Local state for form
  const [killSwitch, setKillSwitch] = useState(false);
  const [watchSymbols, setWatchSymbols] = useState<string[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [weights, setWeights] = useState({
    indicator: 0.4,
    priceAction: 0.35,
    news: 0.25,
  });
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [minConsensusScore, setMinConsensusScore] = useState(0.55);
  const [riskParams, setRiskParams] = useState({
    maxAllocationPct: 10,
    maxOpenPositions: 4,
    stopLossStockPct: 2.5,
    stopLossCryptoPct: 6,
    dailyDrawdownLimitPct: 3,
    maxConsecutiveLosses: 3,
  });

  // Initialize from config
  useEffect(() => {
    if (config) {
      setKillSwitch(config.killSwitch);
      setWatchSymbols(config.watchSymbols || []);
      setWeights(config.weights);
      setMinConfidence(config.minConfidence);
      setMinConsensusScore(config.minConsensusScore);
      setRiskParams({
        maxAllocationPct: config.riskParams.maxAllocationPct,
        maxOpenPositions: config.riskParams.maxOpenPositions,
        stopLossStockPct: config.riskParams.stopLossStockPct,
        stopLossCryptoPct: config.riskParams.stopLossCryptoPct,
        dailyDrawdownLimitPct: config.riskParams.dailyDrawdownLimitPct,
        maxConsecutiveLosses: config.riskParams.maxConsecutiveLosses,
      });
    }
  }, [config]);

  const handleAddSymbol = () => {
    if (!newSymbol.trim()) return;
    const formatted = newSymbol.toUpperCase().trim();
    if (!watchSymbols.includes(formatted)) {
      setWatchSymbols([...watchSymbols, formatted]);
    }
    setNewSymbol('');
  };

  const handleRemoveSymbol = (symbol: string) => {
    setWatchSymbols(watchSymbols.filter((s) => s !== symbol));
  };

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync({
        killSwitch,
        watchSymbols,
        weights,
        minConfidence,
        minConsensusScore,
        riskParams: {
          useLeverage: config?.riskParams?.useLeverage ?? false,
          stopLossAtrMultiplier: config?.riskParams?.stopLossAtrMultiplier ?? 1.5,
          tp1Pct: config?.riskParams?.tp1Pct ?? 50,
          tp2Pct: config?.riskParams?.tp2Pct ?? 25,
          runnerPct: config?.riskParams?.runnerPct ?? 25,
          trailingAtrMultiplier: config?.riskParams?.trailingAtrMultiplier ?? 1,
          ...riskParams,
        },
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/coach">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Coach Settings</h1>
            <p className="text-muted-foreground">
              Configure your trading coach parameters
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Kill Switch */}
      <Card className={killSwitch ? 'border-destructive' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={killSwitch ? 'text-destructive' : ''} />
            Kill Switch
          </CardTitle>
          <CardDescription>
            Emergency stop for all trading analysis and paper trade creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {killSwitch ? 'Kill Switch Active' : 'Kill Switch Inactive'}
              </p>
              <p className="text-sm text-muted-foreground">
                {killSwitch
                  ? 'All coach operations are paused'
                  : 'Coach is operating normally'}
              </p>
            </div>
            <Switch checked={killSwitch} onCheckedChange={setKillSwitch} />
          </div>
        </CardContent>
      </Card>

      {/* Watch Symbols */}
      <Card>
        <CardHeader>
          <CardTitle>Watch Symbols</CardTitle>
          <CardDescription>
            Symbols to analyze when running the coach. Format: SYMBOL or
            SYMBOL:TYPE:MARKET (e.g., AAPL, BTC:crypto:us, MSFT:stock:us)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add symbol (e.g., AAPL, BTC:crypto:us)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
            />
            <Button onClick={handleAddSymbol}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchSymbols.map((symbol) => (
              <Badge key={symbol} variant="secondary" className="text-sm py-1">
                {symbol}
                <button
                  className="ml-2 hover:text-destructive"
                  onClick={() => handleRemoveSymbol(symbol)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {watchSymbols.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No symbols added yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Weights */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Weights</CardTitle>
          <CardDescription>
            How much weight each agent's analysis carries in the consensus (must
            sum to 1.0)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Indicator Agent</Label>
              <span className="text-sm text-muted-foreground">
                {(weights.indicator * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[weights.indicator * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={(values: number[]) =>
                setWeights((w) => ({
                  ...w,
                  indicator: values[0] / 100,
                  priceAction: Math.max(0, 1 - values[0] / 100 - w.news),
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Price Action Agent</Label>
              <span className="text-sm text-muted-foreground">
                {(weights.priceAction * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[weights.priceAction * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={(values: number[]) =>
                setWeights((w) => ({
                  ...w,
                  priceAction: values[0] / 100,
                  news: Math.max(0, 1 - values[0] / 100 - w.indicator),
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>News Agent</Label>
              <span className="text-sm text-muted-foreground">
                {(weights.news * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[weights.news * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={(values: number[]) =>
                setWeights((w) => ({
                  ...w,
                  news: values[0] / 100,
                  indicator: Math.max(0, 1 - values[0] / 100 - w.priceAction),
                }))
              }
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Total: {((weights.indicator + weights.priceAction + weights.news) * 100).toFixed(0)}%
            {Math.abs(weights.indicator + weights.priceAction + weights.news - 1) > 0.01 && (
              <span className="text-destructive ml-2">(must equal 100%)</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Confidence Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Thresholds</CardTitle>
          <CardDescription>
            Minimum confidence required for actionable signals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Minimum Confidence</Label>
              <span className="text-sm text-muted-foreground">
                {(minConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[minConfidence * 100]}
              min={30}
              max={90}
              step={5}
              onValueChange={(values: number[]) => setMinConfidence(values[0] / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Signals below this confidence will default to HOLD
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Minimum Consensus Score</Label>
              <span className="text-sm text-muted-foreground">
                {(minConsensusScore * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[minConsensusScore * 100]}
              min={30}
              max={90}
              step={5}
              onValueChange={(values: number[]) => setMinConsensusScore(values[0] / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Signals below this consensus score will default to HOLD
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Risk Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Management</CardTitle>
          <CardDescription>
            Configure position sizing and risk limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxAllocation">Max Allocation per Trade (%)</Label>
              <Input
                id="maxAllocation"
                type="number"
                min={1}
                max={100}
                value={riskParams.maxAllocationPct}
                onChange={(e) =>
                  setRiskParams((r) => ({
                    ...r,
                    maxAllocationPct: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPositions">Max Open Positions</Label>
              <Input
                id="maxPositions"
                type="number"
                min={1}
                max={20}
                value={riskParams.maxOpenPositions}
                onChange={(e) =>
                  setRiskParams((r) => ({
                    ...r,
                    maxOpenPositions: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stopLossStock">Stock Stop Loss (%)</Label>
              <Input
                id="stopLossStock"
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={riskParams.stopLossStockPct}
                onChange={(e) =>
                  setRiskParams((r) => ({
                    ...r,
                    stopLossStockPct: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopLossCrypto">Crypto Stop Loss (%)</Label>
              <Input
                id="stopLossCrypto"
                type="number"
                min={1}
                max={20}
                step={0.5}
                value={riskParams.stopLossCryptoPct}
                onChange={(e) =>
                  setRiskParams((r) => ({
                    ...r,
                    stopLossCryptoPct: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dailyDrawdown">Daily Drawdown Limit (%)</Label>
              <Input
                id="dailyDrawdown"
                type="number"
                min={1}
                max={20}
                step={0.5}
                value={riskParams.dailyDrawdownLimitPct}
                onChange={(e) =>
                  setRiskParams((r) => ({
                    ...r,
                    dailyDrawdownLimitPct: parseFloat(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Circuit breaker triggers when daily loss exceeds this
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLosses">Max Consecutive Losses</Label>
              <Input
                id="maxLosses"
                type="number"
                min={1}
                max={10}
                value={riskParams.maxConsecutiveLosses}
                onChange={(e) =>
                  setRiskParams((r) => ({
                    ...r,
                    maxConsecutiveLosses: parseInt(e.target.value) || 1,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Circuit breaker triggers after this many losses in a row
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
          {updateConfig.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
