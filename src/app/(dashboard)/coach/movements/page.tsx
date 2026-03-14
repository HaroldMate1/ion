'use client';

/**
 * Coach Movements Page
 * Timeline log of all auto-executed coach trades
 */

import Link from 'next/link';
import { useCoachTrades } from '@/hooks/use-coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import type { CoachPaperTrade } from '@/lib/coach/types';

export default function MovementsPage() {
  const { data: tradesData, isLoading } = useCoachTrades({ limit: 50 });

  const trades = tradesData?.trades || [];
  const totalTrades = trades.length;
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status !== 'open');
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnlUsd || 0), 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/coach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Coach Movements</h1>
          <p className="text-muted-foreground">
            Auto-executed trades by the AI trading coach
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrades}</div>
            <p className="text-xs text-muted-foreground">
              {openTrades.length} open, {closedTrades.length} closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTrades.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Realized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${totalPnL.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Movements Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Chronological record of all coach actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No movements yet.</p>
              <p className="text-sm mt-1">
                Run analysis to let the coach auto-execute trades.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {trades.map((trade, index) => (
                <MovementEntry key={trade.id} trade={trade} isLast={index === trades.length - 1} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MovementEntry({ trade, isLast }: { trade: CoachPaperTrade; isLast: boolean }) {
  const isBuy = trade.side === 'BUY';
  const isOpen = trade.status === 'open';
  const date = new Date(trade.openedAt || trade.createdAt || '');
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Parse TP levels from trade data
  const takeProfits = trade.takeProfitJson || [];
  const stopLoss = trade.stopLoss;
  const stopDist = stopLoss ? Math.abs(trade.entryPrice - stopLoss) : 0;

  return (
    <div className="flex gap-4 pb-4">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1.5 ${isBuy ? 'bg-green-500' : 'bg-red-500'}`} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {isBuy ? (
                <Badge className="bg-green-500 text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  BUY
                </Badge>
              ) : (
                <Badge className="bg-red-500 text-xs">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  SELL
                </Badge>
              )}
              <span className="font-semibold">{trade.symbol}</span>
              <StatusBadge status={trade.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isBuy ? 'Bought' : 'Sold'} at ${trade.entryPrice.toFixed(2)} &middot; Position: ${trade.sizeUsd.toFixed(2)}
            </p>

            {/* Risk Management Details */}
            <div className="mt-2 space-y-1">
              {/* Stop Loss */}
              {stopLoss != null && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">SL</Badge>
                  <span className="text-muted-foreground">
                    ${stopLoss.toFixed(2)} ({((stopDist / trade.entryPrice) * 100).toFixed(1)}% risk)
                  </span>
                </div>
              )}

              {/* Take Profit Levels */}
              {takeProfits.length > 0 && (
                <div className="space-y-0.5">
                  {takeProfits.map((tp: any, i: number) => {
                    const pctFromEntry = ((tp.price - trade.entryPrice) / trade.entryPrice * 100).toFixed(1);
                    const rMultiple = stopDist > 0
                      ? (Math.abs(tp.price - trade.entryPrice) / stopDist).toFixed(1)
                      : '?';
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge className="bg-emerald-600 text-xs px-1.5 py-0">
                          TP{i + 1}
                        </Badge>
                        <span className="text-muted-foreground">
                          ${tp.price.toFixed(2)} ({pctFromEntry}%, {rMultiple}R)
                          &bull; Close {tp.percentage}% of position
                          {tp.type === 'trailing' && ' (trailing)'}
                        </span>
                      </div>
                    );
                  })}
                  {/* TP Explanation */}
                  <p className="text-xs text-muted-foreground/70 mt-1 italic pl-1">
                    {stopDist > 0 ? (
                      <>
                        TPs based on ${stopDist.toFixed(2)} risk per share (1R).
                        TP1 at 1× risk, TP2 at 2× risk, Runner at 2.5× with trailing stop.
                      </>
                    ) : (
                      'Take profits set by analysis engine based on support/resistance levels.'
                    )}
                  </p>
                </div>
              )}
            </div>

            {trade.notes && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                {trade.notes}
              </p>
            )}
            {!isOpen && trade.exitPrice && (
              <p className="text-sm mt-1">
                Closed at ${trade.exitPrice.toFixed(2)}
                {trade.pnlUsd !== undefined && (
                  <span className={`ml-2 font-medium ${trade.pnlUsd >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.pnlUsd >= 0 ? '+' : ''}${trade.pnlUsd.toFixed(2)} ({trade.pnlPct?.toFixed(1)}%)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="text-right text-sm text-muted-foreground">
            <p>{formattedDate}</p>
            <p>{formattedTime}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return <Badge variant="outline" className="text-xs">Open</Badge>;
    case 'closed':
      return <Badge variant="secondary" className="text-xs">Closed</Badge>;
    case 'stopped':
      return <Badge variant="destructive" className="text-xs">Stopped</Badge>;
    case 'tp_hit':
      return <Badge className="bg-green-500 text-xs">TP Hit</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}
