'use client';

/**
 * Signal Detail Page
 * Shows full analysis and allows creating paper trades
 */

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useCoachSignal,
  useAcknowledgeSignal,
  useCreatePaperTrade,
} from '@/hooks/use-coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle,
  Target,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

export default function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: signal, isLoading, error } = useCoachSignal(id);
  const acknowledgeSignal = useAcknowledgeSignal();
  const createTrade = useCreatePaperTrade();

  const [tradeSize, setTradeSize] = useState('1000');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateTrade = async () => {
    if (!signal) return;

    try {
      await createTrade.mutateAsync({
        signalId: signal.id,
        symbol: signal.symbol,
        assetType: signal.assetType,
        market: signal.market,
        side: signal.consensusAction === 'BUY' ? 'BUY' : 'SELL',
        entryPrice: signal.currentPrice || signal.entryHigh || 0,
        sizeUsd: parseFloat(tradeSize),
        stopLoss: signal.stopLoss,
        takeProfitJson: signal.takeProfitJson,
      });
      setIsCreateDialogOpen(false);
      router.push('/coach/trades');
    } catch (error) {
      console.error('Failed to create trade:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Signal Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The signal you're looking for doesn't exist or has been deleted.
          </p>
          <Link href="/coach">
            <Button>Back to Coach</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/coach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{signal.symbol}</h1>
            <ActionBadge action={signal.consensusAction} />
            {signal.acknowledged && (
              <Badge variant="secondary">
                <CheckCircle className="h-3 w-3 mr-1" />
                Reviewed
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {signal.assetType.toUpperCase()} • {signal.market.toUpperCase()} •{' '}
            {signal.timeframe}
          </p>
        </div>
        <div className="flex gap-2">
          {!signal.acknowledged && (
            <Button
              variant="outline"
              onClick={() =>
                acknowledgeSignal.mutate({ id: signal.id, acknowledged: true })
              }
              disabled={acknowledgeSignal.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Reviewed
            </Button>
          )}
          {signal.consensusAction !== 'HOLD' && !signal.isStale && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create Paper Trade</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Paper Trade</DialogTitle>
                  <DialogDescription>
                    Create a paper trade based on this signal. This is for
                    practice only and uses no real money.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Symbol</Label>
                      <p className="text-lg font-medium">{signal.symbol}</p>
                    </div>
                    <div>
                      <Label>Side</Label>
                      <p className="text-lg font-medium">
                        {signal.consensusAction}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label>Entry Price</Label>
                    <p className="text-lg font-medium">
                      ${signal.currentPrice?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="tradeSize">Position Size (USD)</Label>
                    <Input
                      id="tradeSize"
                      type="number"
                      value={tradeSize}
                      onChange={(e) => setTradeSize(e.target.value)}
                      min="10"
                      max="100000"
                    />
                  </div>
                  {signal.stopLoss && (
                    <div>
                      <Label>Stop Loss</Label>
                      <p className="text-lg font-medium text-red-500">
                        ${signal.stopLoss.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTrade}
                    disabled={createTrade.isPending}
                  >
                    {createTrade.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Create Trade
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stale Warning */}
      {signal.isStale && (
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <div>
            <p className="font-medium text-yellow-500">Signal May Be Stale</p>
            <p className="text-sm text-muted-foreground">
              This signal was generated when market conditions may have changed.
              Consider running fresh analysis.
            </p>
          </div>
        </div>
      )}

      {/* Signal Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Consensus Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(signal.consensusScore * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${signal.currentPrice?.toFixed(2) || 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expected Return</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {signal.expectedReturnPct?.toFixed(1) || 'N/A'}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk/Reward</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {signal.riskRewardRatio?.toFixed(2) || 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entry/Exit Levels */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Entry Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signal.entryLow && signal.entryHigh ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low</span>
                  <span className="font-medium">${signal.entryLow.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High</span>
                  <span className="font-medium">${signal.entryHigh.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No entry zone specified</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Stop Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signal.stopLoss ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium text-red-500">
                    ${signal.stopLoss.toFixed(2)}
                  </span>
                </div>
                {signal.currentPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-medium">
                      {(
                        ((signal.currentPrice - signal.stopLoss) /
                          signal.currentPrice) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No stop loss specified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Take Profits */}
      {signal.takeProfitJson && signal.takeProfitJson.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Take Profit Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {signal.takeProfitJson.map((tp, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">TP{index + 1}</p>
                    <p className="text-sm text-muted-foreground">
                      {tp.type === 'trailing' ? 'Trailing' : 'Fixed'} •{' '}
                      {tp.percentage}% of position
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-500">
                      ${tp.price.toFixed(2)}
                    </p>
                    {signal.currentPrice && (
                      <p className="text-sm text-muted-foreground">
                        +
                        {(
                          ((tp.price - signal.currentPrice) /
                            signal.currentPrice) *
                          100
                        ).toFixed(2)}
                        %
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Votes */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Analysis</CardTitle>
          <CardDescription>
            Individual agent proposals that contributed to the consensus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {signal.agentVotesJson?.map((vote, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{vote.agent}</h4>
                    <ActionBadge action={vote.action} />
                  </div>
                  <Badge variant="outline">
                    {(vote.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {vote.rationale}
                </p>
                {vote.metrics && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(vote.metrics).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Rationale */}
      <Card>
        <CardHeader>
          <CardTitle>Full Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
            {signal.rationale}
          </pre>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Signal Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Signal ID</p>
              <p className="font-mono">{signal.id.slice(0, 8)}...</p>
            </div>
            <div>
              <p className="text-muted-foreground">Generated</p>
              <p>{new Date(signal.signalTs).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Market Status</p>
              <p>{signal.marketOpen ? 'Open' : 'Closed'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Expected Risk</p>
              <p>{signal.expectedRiskPct?.toFixed(2) || 'N/A'}%</p>
            </div>
          </div>
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
