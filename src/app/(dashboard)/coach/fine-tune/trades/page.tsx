'use client';

/**
 * Fine-Tune Trades Page
 * Lists all Fine-Tune paper trades with filtering
 */

import { useState } from 'react';
import Link from 'next/link';
import { useFineTuneTrades } from '@/hooks/use-fine-tune-portfolio';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Briefcase,
  Brain,
} from 'lucide-react';

export default function FineTuneTradesPage() {
  const [activeTab, setActiveTab] = useState<'open' | 'closed' | 'all'>('all');
  const { data: tradesData, isLoading } = useFineTuneTrades();

  const allTrades: any[] = tradesData?.trades || [];
  const filtered = activeTab === 'all' ? allTrades
    : activeTab === 'open'  ? allTrades.filter(t => t.status === 'open')
    : allTrades.filter(t => t.status !== 'open');

  const totalRealizedPnl = allTrades
    .filter(t => t.status !== 'open' && t.pnl_usd != null)
    .reduce((s, t) => s + Number(t.pnl_usd), 0);

  const wins  = allTrades.filter(t => t.status !== 'open' && Number(t.pnl_usd) > 0).length;
  const total = allTrades.filter(t => t.status !== 'open').length;

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
          <h1 className="text-2xl font-bold">Fine-Tune Trades</h1>
          <p className="text-sm text-muted-foreground">All paper trades from the Fine-Tune portfolio</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Trades</p>
            <p className="text-2xl font-bold">{allTrades.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Realized P&L</p>
            <p className={`text-2xl font-bold ${totalRealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold">
              {total > 0 ? ((wins / total) * 100).toFixed(0) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trades list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-purple-500" />
            Trade History
          </CardTitle>
          <CardDescription>Fine-Tune pharma portfolio — all trades</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({allTrades.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({allTrades.filter(t => t.status === 'open').length})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({allTrades.filter(t => t.status !== 'open').length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No trades yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((trade: any) => {
                    const pnl    = Number(trade.pnl_usd  ?? 0);
                    const pnlPct = Number(trade.pnl_pct  ?? 0);
                    const isOpen = trade.status === 'open';
                    return (
                      <div key={trade.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge
                            className={`text-[10px] shrink-0 ${trade.side === 'BUY' ? 'bg-green-500/15 text-green-600 border-green-500/30' : 'bg-red-500/15 text-red-600 border-red-500/30'}`}
                            variant="outline"
                          >
                            {trade.side}
                          </Badge>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{trade.symbol}</span>
                              {isOpen && <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">Open</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {Number(trade.quantity).toFixed(4)} @ ${Number(trade.entry_price).toFixed(2)}
                              {trade.exit_price ? ` → $${Number(trade.exit_price).toFixed(2)}` : ''}
                              {' · '}{new Date(trade.opened_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-medium text-sm">
                            ${Number(trade.size_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          {!isOpen && (
                            <div className={`text-xs font-medium flex items-center justify-end gap-1 ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
