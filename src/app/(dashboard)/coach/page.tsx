'use client';

/**
 * Trading Coach Overview Page
 * Main dashboard for the AI trading coach
 */

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useCoachSummary,
  useCoachSignals,
  useRunAnalysis,
  useToggleKillSwitch,
  useAcknowledgeSignal,
} from '@/hooks/use-coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  Power,
  RefreshCw,
  CheckCircle,
  Settings,
  FileText,
  Briefcase,
  ScrollText,
} from 'lucide-react';

export default function CoachPage() {
  const { isLoading, config, unacknowledgedSignals, actionableSignals, openTrades, unrealizedPnL, killSwitchActive } =
    useCoachSummary();
  const { data: signalsData, isLoading: signalsLoading } = useCoachSignals({ limit: 10 });
  const runAnalysis = useRunAnalysis();
  const toggleKillSwitch = useToggleKillSwitch();
  const acknowledgeSignal = useAcknowledgeSignal();

  const [isRunning, setIsRunning] = useState(false);

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      const result = await runAnalysis.mutateAsync({});

      if (result.killSwitchActive) {
        toast.warning('Kill switch is active. Disable it to run analysis.');
      } else if (result.signalsGenerated === 0) {
        toast.info(result.message || 'No signals generated. Add symbols to your watchlist.');
      } else {
        toast.success(`Generated ${result.signalsGenerated} signal(s)`);
      }

      // Show auto-executed trades
      if (result.autoExecutedTrades && result.autoExecutedTrades.length > 0) {
        for (const trade of result.autoExecutedTrades) {
          toast.success(`Auto-${trade.side}: ${trade.symbol} ($${trade.sizeUsd.toFixed(0)})`);
        }
      }

      if (result.errors && result.errors.length > 0) {
        console.error('Analysis errors:', result.errors);
        result.errors.forEach((err: string) => {
          toast.error(err);
        });
      }
    } catch (error: any) {
      console.error('Run analysis error:', error);
      toast.error(error.message || 'Failed to run analysis');
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleKillSwitch = () => {
    toggleKillSwitch.mutate(!killSwitchActive, {
      onSuccess: () => {
        toast.success(killSwitchActive ? 'Kill switch deactivated' : 'Kill switch activated');
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to toggle kill switch');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Trading Coach</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered trading analysis and education
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Link href="/coach/settings">
            <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
              <Settings className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Settings</span>
            </Button>
          </Link>
          <Link href="/coach/reports">
            <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
              <FileText className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Reports</span>
            </Button>
          </Link>
          <Link href="/coach/trades">
            <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
              <Briefcase className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Paper Trades</span>
            </Button>
          </Link>
          <Link href="/coach/movements">
            <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
              <ScrollText className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Movements</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Kill Switch Alert */}
      {killSwitchActive && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-destructive">Kill Switch Active</p>
            <p className="text-sm text-muted-foreground">
              All trading analysis and paper trade creation is paused.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleToggleKillSwitch}
            disabled={toggleKillSwitch.isPending}
          >
            <Power className="h-4 w-4 mr-2" />
            Deactivate
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Signals</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{actionableSignals}</div>
            <p className="text-xs text-muted-foreground">
              Auto-executed by coach
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Trades</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTrades}</div>
            <p className="text-xs text-muted-foreground">
              No limit — fully autonomous
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
            {unrealizedPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            >
              ${unrealizedPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Paper trades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watch Symbols</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {config?.watchSymbols?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {config?.watchSymbols?.slice(0, 3).join(', ') || 'None configured'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleRunAnalysis}
          disabled={isRunning || killSwitchActive}
          className="w-full sm:w-auto"
        >
          {isRunning ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Analysis
        </Button>
        {!killSwitchActive && (
          <Button
            variant="outline"
            onClick={handleToggleKillSwitch}
            disabled={toggleKillSwitch.isPending}
          >
            <Power className="h-4 w-4 mr-2" />
            Activate Kill Switch
          </Button>
        )}
      </div>

      {/* Recent Signals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
          <CardDescription>
            Latest trading signals from the coach
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signalsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : signalsData?.signals?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No signals yet.</p>
              <p className="text-sm">
                Add symbols to your watchlist and run analysis to generate
                signals.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {signalsData?.signals?.map((signal) => (
                <div
                  key={signal.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ActionBadge action={signal.consensusAction} />
                      <Link
                        href={`/coach/signals/${signal.id}`}
                        className="font-medium hover:underline"
                      >
                        {signal.symbol}
                      </Link>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {(signal.consensusScore * 100).toFixed(0)}%
                      </p>
                      {signal.riskRewardRatio && (
                        <p className="text-xs text-muted-foreground">
                          R:R {signal.riskRewardRatio.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {signal.timeframe} • {new Date(signal.signalTs).toLocaleDateString()}
                    </p>
                    {signal.acknowledged ? (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Auto-executed
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs cursor-pointer"
                        onClick={() =>
                          acknowledgeSignal.mutate({
                            id: signal.id,
                            acknowledged: true,
                          })
                        }
                      >
                        Dismiss
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {signalsData && signalsData.total > 10 && (
            <div className="mt-4 text-center">
              <Link href="/coach/signals">
                <Button variant="outline">View All Signals</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionBadge({ action }: { action: 'BUY' | 'SELL' | 'HOLD' }) {
  switch (action) {
    case 'BUY':
      return (
        <Badge className="bg-green-500">
          <TrendingUp className="h-3 w-3 mr-1" />
          BUY
        </Badge>
      );
    case 'SELL':
      return (
        <Badge className="bg-red-500">
          <TrendingDown className="h-3 w-3 mr-1" />
          SELL
        </Badge>
      );
    case 'HOLD':
      return (
        <Badge variant="secondary">
          <Minus className="h-3 w-3 mr-1" />
          HOLD
        </Badge>
      );
  }
}
