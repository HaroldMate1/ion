'use client';

/**
 * Fine-Tune Settings Page
 * Kill switch, active weights, and portfolio status
 */

import Link from 'next/link';
import { toast } from 'sonner';
import {
  useFineTuneConfig,
  useToggleFineTuneKillSwitch,
  useResetFineTune,
} from '@/hooks/use-fine-tune-portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  FlaskConical,
  Power,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Brain,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

function WeightBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs w-28 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-sm font-mono font-medium w-12 text-right">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function FineTuneSettingsPage() {
  const { data: config, isLoading } = useFineTuneConfig();
  const toggleKillSwitch = useToggleFineTuneKillSwitch();
  const resetFineTune    = useResetFineTune();
  const [confirmReset, setConfirmReset] = useState(false);

  const killSwitchActive = config?.killSwitch ?? false;

  const handleToggleKillSwitch = (checked: boolean) => {
    toggleKillSwitch.mutate(checked, {
      onSuccess: () => toast.success(checked ? 'Kill switch activated' : 'Kill switch deactivated'),
      onError: (err: any) => toast.error(err.message || 'Failed to toggle kill switch'),
    });
  };

  const handleReset = async () => {
    try {
      await resetFineTune.mutateAsync();
      setConfirmReset(false);
      toast.success('Fine-Tune portfolio reset.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset');
    }
  };

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 px-2 md:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coach/fine-tune">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-500" />
            <h1 className="text-2xl font-bold">Fine-Tune Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kill switch, weights, and portfolio management</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Kill Switch */}
          <Card className={killSwitchActive ? 'border-destructive' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Power className="h-5 w-5 text-destructive" />
                Kill Switch
              </CardTitle>
              <CardDescription>
                Pause all Fine-Tune automated trading immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="kill-switch" className="text-sm font-medium">
                    {killSwitchActive ? 'Trading is PAUSED' : 'Trading is active'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {killSwitchActive
                      ? 'No new trades will be opened or signals executed.'
                      : 'The portfolio is running normally.'}
                  </p>
                </div>
                <Switch
                  id="kill-switch"
                  checked={killSwitchActive}
                  onCheckedChange={handleToggleKillSwitch}
                  disabled={toggleKillSwitch.isPending}
                  className="data-[state=checked]:bg-destructive"
                />
              </div>
              {killSwitchActive && (
                <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Kill switch is active — all trading is paused.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Weights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                Active Agent Weights
              </CardTitle>
              <CardDescription>
                Current weights applied to the Fine-Tune portfolio. These are auto-adjusted after losing trades.
                Run a backtest from the main page to re-optimize.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config?.isActive ? (
                <>
                  <WeightBar label="Indicator"    value={config.weights.indicator   ?? 0.45} color="bg-blue-500" />
                  <WeightBar label="Price Action" value={config.weights.priceAction ?? 0.45} color="bg-amber-500" />
                  <WeightBar label="News"         value={config.weights.news        ?? 0.10} color="bg-green-500" />
                  {config.lastAppliedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last manually applied: {new Date(config.lastAppliedAt).toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                    <strong>Auto-adaptation:</strong> When a trade closes at a loss, the system studies which agents
                    contributed to the wrong call and slightly reduces their weights — helping the model learn over time.
                  </p>
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No weights applied yet. Run a backtest from the Fine-Tune page and apply the results.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Reset */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <RotateCcw className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Reset the Fine-Tune portfolio — this deletes all trades, signals, and the current configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {confirmReset ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground flex-1">
                    This will permanently delete all Fine-Tune trades and config. Are you sure?
                  </p>
                  <Button size="sm" variant="destructive" onClick={handleReset} disabled={resetFineTune.isPending}>
                    {resetFineTune.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, reset'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setConfirmReset(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Fine-Tune Portfolio
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
