'use client';

/**
 * Paper Trades Page
 * Lists all paper trades with filtering and close functionality
 */

import { useState } from 'react';
import Link from 'next/link';
import { useCoachTrades, useClosePaperTrade } from '@/hooks/use-coach';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  X,
} from 'lucide-react';
import type { CoachPaperTrade } from '@/lib/coach/types';

export default function PaperTradesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: tradesData, isLoading } = useCoachTrades(
    statusFilter !== 'all' ? { status: statusFilter } : {}
  );
  const closeTrade = useClosePaperTrade();

  const [closingTrade, setClosingTrade] = useState<CoachPaperTrade | null>(null);
  const [exitPrice, setExitPrice] = useState('');

  const handleCloseTrade = async () => {
    if (!closingTrade || !exitPrice) return;

    try {
      await closeTrade.mutateAsync({
        tradeId: closingTrade.id,
        exitPrice: parseFloat(exitPrice),
      });
      setClosingTrade(null);
      setExitPrice('');
    } catch (error) {
      console.error('Failed to close trade:', error);
    }
  };

  const openTrades = tradesData?.trades?.filter((t) => t.status === 'open') || [];
  const closedTrades = tradesData?.trades?.filter((t) => t.status !== 'open') || [];

  // Calculate totals
  const totalUnrealizedPnL = openTrades.reduce(
    (sum, t) => sum + (t.pnlUsd || 0),
    0
  );
  const totalRealizedPnL = closedTrades.reduce(
    (sum, t) => sum + (t.pnlUsd || 0),
    0
  );
  const winCount = closedTrades.filter((t) => (t.pnlUsd || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;

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
          <h1 className="text-3xl font-bold">Paper Trades</h1>
          <p className="text-muted-foreground">
            Track your practice trades and performance
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTrades.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unrealized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            >
              ${totalUnrealizedPnL.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Realized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalRealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            >
              ${totalRealizedPnL.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {winCount} / {closedTrades.length} trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trades List */}
      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">
            Open ({openTrades.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({closedTrades.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Card>
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
              <CardDescription>
                Your currently active paper trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : openTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No open paper trades.</p>
                  <p className="text-sm">
                    Create a paper trade from a signal to start practicing.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openTrades.map((trade) => (
                    <TradeRow
                      key={trade.id}
                      trade={trade}
                      onClose={() => {
                        setClosingTrade(trade);
                        setExitPrice(trade.entryPrice.toFixed(2));
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closed">
          <Card>
            <CardHeader>
              <CardTitle>Closed Trades</CardTitle>
              <CardDescription>
                Your completed paper trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : closedTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No closed paper trades yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {closedTrades.map((trade) => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Close Trade Dialog */}
      <Dialog open={!!closingTrade} onOpenChange={() => setClosingTrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Paper Trade</DialogTitle>
            <DialogDescription>
              Enter the exit price to close this paper trade.
            </DialogDescription>
          </DialogHeader>
          {closingTrade && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Symbol</Label>
                  <p className="text-lg font-medium">{closingTrade.symbol}</p>
                </div>
                <div>
                  <Label>Side</Label>
                  <p className="text-lg font-medium">{closingTrade.side}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entry Price</Label>
                  <p className="text-lg font-medium">
                    ${closingTrade.entryPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label>Position Size</Label>
                  <p className="text-lg font-medium">
                    ${closingTrade.sizeUsd.toFixed(2)}
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="exitPrice">Exit Price</Label>
                <Input
                  id="exitPrice"
                  type="number"
                  step="0.01"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                />
              </div>
              {exitPrice && (
                <div className="bg-muted p-3 rounded-lg">
                  <Label>Estimated P&L</Label>
                  {(() => {
                    const exit = parseFloat(exitPrice);
                    const pnl =
                      closingTrade.side === 'BUY'
                        ? (exit - closingTrade.entryPrice) * closingTrade.quantity
                        : (closingTrade.entryPrice - exit) * closingTrade.quantity;
                    const pnlPct =
                      (pnl / closingTrade.sizeUsd) * 100;
                    return (
                      <p
                        className={`text-lg font-medium ${
                          pnl >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        ${pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingTrade(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCloseTrade}
              disabled={closeTrade.isPending || !exitPrice}
            >
              {closeTrade.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Close Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TradeRow({
  trade,
  onClose,
}: {
  trade: CoachPaperTrade;
  onClose?: () => void;
}) {
  const isOpen = trade.status === 'open';

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div>
          {trade.side === 'BUY' ? (
            <Badge className="bg-green-500">
              <TrendingUp className="h-3 w-3 mr-1" />
              LONG
            </Badge>
          ) : (
            <Badge className="bg-red-500">
              <TrendingDown className="h-3 w-3 mr-1" />
              SHORT
            </Badge>
          )}
        </div>
        <div>
          <p className="font-medium">{trade.symbol}</p>
          <p className="text-sm text-muted-foreground">
            {trade.quantity.toFixed(4)} @ ${trade.entryPrice.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Size</p>
          <p className="font-medium">${trade.sizeUsd.toFixed(2)}</p>
        </div>

        {!isOpen && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Exit</p>
            <p className="font-medium">${trade.exitPrice?.toFixed(2)}</p>
          </div>
        )}

        <div className="text-right min-w-[100px]">
          <p className="text-sm text-muted-foreground">P&L</p>
          {trade.pnlUsd !== undefined ? (
            <p
              className={`font-medium ${
                trade.pnlUsd >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            >
              ${trade.pnlUsd.toFixed(2)} ({trade.pnlPct?.toFixed(2)}%)
            </p>
          ) : (
            <p className="text-muted-foreground">-</p>
          )}
        </div>

        {!isOpen && (
          <div>
            <StatusBadge status={trade.status} />
          </div>
        )}

        {isOpen && onClose && (
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    case 'stopped':
      return <Badge variant="destructive">Stopped Out</Badge>;
    case 'tp_hit':
      return <Badge className="bg-green-500">TP Hit</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
