'use client';

/**
 * Signals List Page
 * View all signals with filtering
 */

import { useState } from 'react';
import Link from 'next/link';
import { useCoachSignals, useAcknowledgeSignal } from '@/hooks/use-coach';
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
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  CheckCircle,
  Filter,
} from 'lucide-react';

export default function SignalsListPage() {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('all');

  const { data: signalsData, isLoading } = useCoachSignals({
    action: actionFilter !== 'all' ? actionFilter : undefined,
    acknowledged: acknowledgedFilter === 'all' ? undefined : acknowledgedFilter === 'true',
    limit: 100,
  });

  const acknowledgeSignal = useAcknowledgeSignal();

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
          <h1 className="text-3xl font-bold">All Signals</h1>
          <p className="text-muted-foreground">
            View and filter all trading signals
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="BUY">BUY</SelectItem>
            <SelectItem value="SELL">SELL</SelectItem>
            <SelectItem value="HOLD">HOLD</SelectItem>
          </SelectContent>
        </Select>

        <Select value={acknowledgedFilter} onValueChange={setAcknowledgedFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="false">Unreviewed</SelectItem>
            <SelectItem value="true">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        {(actionFilter !== 'all' || acknowledgedFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter('all');
              setAcknowledgedFilter('all');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Signals List */}
      <Card>
        <CardHeader>
          <CardTitle>Signals</CardTitle>
          <CardDescription>
            {signalsData?.total || 0} signals found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : signalsData?.signals?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No signals found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signalsData?.signals?.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <ActionBadge action={signal.consensusAction} />
                    <div>
                      <Link
                        href={`/coach/signals/${signal.id}`}
                        className="font-medium hover:underline"
                      >
                        {signal.symbol}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {signal.assetType.toUpperCase()} • {signal.market.toUpperCase()} •{' '}
                        {signal.timeframe}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm">
                        Score: {(signal.consensusScore * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(signal.signalTs).toLocaleString()}
                      </p>
                    </div>

                    {signal.riskRewardRatio && (
                      <div className="text-right min-w-[60px]">
                        <p className="text-sm text-muted-foreground">R:R</p>
                        <p className="font-medium">{signal.riskRewardRatio.toFixed(1)}</p>
                      </div>
                    )}

                    {signal.acknowledged ? (
                      <Badge variant="secondary" className="min-w-[90px] justify-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Reviewed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-[90px]"
                        onClick={() =>
                          acknowledgeSignal.mutate({
                            id: signal.id,
                            acknowledged: true,
                          })
                        }
                        disabled={acknowledgeSignal.isPending}
                      >
                        Review
                      </Button>
                    )}

                    <Link href={`/coach/signals/${signal.id}`}>
                      <Button size="sm" variant="ghost">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
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
        <Badge className="bg-green-500 min-w-[60px] justify-center">
          <TrendingUp className="h-3 w-3 mr-1" />
          BUY
        </Badge>
      );
    case 'SELL':
      return (
        <Badge className="bg-red-500 min-w-[60px] justify-center">
          <TrendingDown className="h-3 w-3 mr-1" />
          SELL
        </Badge>
      );
    case 'HOLD':
      return (
        <Badge variant="secondary" className="min-w-[60px] justify-center">
          <Minus className="h-3 w-3 mr-1" />
          HOLD
        </Badge>
      );
  }
}
