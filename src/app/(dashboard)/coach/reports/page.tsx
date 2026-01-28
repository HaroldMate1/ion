'use client';

/**
 * Coach Reports Page
 * View and generate daily performance reports
 */

import { useState } from 'react';
import Link from 'next/link';
import { useCoachReports, useGenerateReport } from '@/hooks/use-coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DailyReportMetrics } from '@/lib/coach/types';

export default function CoachReportsPage() {
  const { data: reportsData, isLoading } = useCoachReports({ limit: 30 });
  const generateReport = useGenerateReport();

  const handleGenerateReport = async () => {
    try {
      await generateReport.mutateAsync(undefined);
      toast.success('Report generated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    }
  };

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
            <h1 className="text-3xl font-bold">Daily Reports</h1>
            <p className="text-muted-foreground">
              Track your trading coach performance over time
            </p>
          </div>
        </div>
        <Button onClick={handleGenerateReport} disabled={generateReport.isPending}>
          {generateReport.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Generate Today's Report
        </Button>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>
            Daily summaries of your trading coach activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reportsData?.reports?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No reports generated yet.</p>
              <p className="text-sm">
                Generate your first daily report to start tracking performance.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportsData?.reports?.map((report) => (
                <ReportCard
                  key={report.id}
                  date={report.reportDate}
                  metrics={report.metricsJson}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportCard({
  date,
  metrics,
}: {
  date: string;
  metrics: DailyReportMetrics;
}) {
  const [expanded, setExpanded] = useState(false);

  const totalPnL = metrics.realizedPnlUsd + metrics.unrealizedPnlUsd;
  const isProfitable = totalPnL >= 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Summary Row */}
      <div
        className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {metrics.signalsGenerated} signals • {metrics.paperTradesOpened} trades
              opened • {metrics.paperTradesClosed} closed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {metrics.circuitBreakerTriggered && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Circuit Breaker
            </Badge>
          )}
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p
              className={`font-medium ${
                isProfitable ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isProfitable ? '+' : ''}${totalPnL.toFixed(2)}
            </p>
          </div>
          <div className="text-right min-w-[80px]">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="font-medium">{metrics.winRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t p-4 bg-muted/30 space-y-4">
          {/* Signals Breakdown */}
          <div>
            <h4 className="text-sm font-medium mb-2">Signals by Action</h4>
            <div className="flex gap-4">
              <Badge className="bg-green-500">
                <TrendingUp className="h-3 w-3 mr-1" />
                BUY: {metrics.signalsByAction.BUY}
              </Badge>
              <Badge className="bg-red-500">
                <TrendingDown className="h-3 w-3 mr-1" />
                SELL: {metrics.signalsByAction.SELL}
              </Badge>
              <Badge variant="secondary">HOLD: {metrics.signalsByAction.HOLD}</Badge>
            </div>
          </div>

          {/* P&L Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Realized P&L</h4>
              <p
                className={`text-lg font-medium ${
                  metrics.realizedPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                ${metrics.realizedPnlUsd.toFixed(2)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Unrealized P&L</h4>
              <p
                className={`text-lg font-medium ${
                  metrics.unrealizedPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                ${metrics.unrealizedPnlUsd.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Top Performers */}
          {metrics.topPerformers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Top Performers</h4>
              <div className="flex gap-2">
                {metrics.topPerformers.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-green-500">
                    {p.symbol}: +{p.pnlPct.toFixed(2)}%
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Worst Performers */}
          {metrics.worstPerformers.length > 0 &&
            metrics.worstPerformers.some((p) => p.pnlPct < 0) && (
              <div>
                <h4 className="text-sm font-medium mb-2">Worst Performers</h4>
                <div className="flex gap-2">
                  {metrics.worstPerformers
                    .filter((p) => p.pnlPct < 0)
                    .map((p, i) => (
                      <Badge key={i} variant="outline" className="text-red-500">
                        {p.symbol}: {p.pnlPct.toFixed(2)}%
                      </Badge>
                    ))}
                </div>
              </div>
            )}

          {/* Notes */}
          {metrics.notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{metrics.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
