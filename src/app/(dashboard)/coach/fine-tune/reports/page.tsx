'use client';

/**
 * Fine-Tune Reports Page
 * Daily performance reports for the pharma/biotech Fine-Tune portfolio
 */

import { useState } from 'react';
import Link from 'next/link';
import { useFineTuneReports, useGenerateFineTuneReport } from '@/hooks/use-fine-tune-portfolio';
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
  ChevronDown,
  ChevronUp,
  FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DailyReportMetrics } from '@/lib/coach/types';

export default function FineTuneReportsPage() {
  const { data: reportsData, isLoading } = useFineTuneReports({ limit: 30 });
  const generateReport = useGenerateFineTuneReport();

  const handleGenerateReport = async () => {
    try {
      const result = await generateReport.mutateAsync(undefined);
      if (result.skipped) {
        toast.info(result.reason || 'No activity to report today');
      } else {
        toast.success('Report generated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    }
  };

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/coach/fine-tune">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-purple-500" />
              <h1 className="text-2xl md:text-3xl font-bold">Fine-Tune Reports</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Automated daily summaries for the pharma/biotech portfolio
            </p>
          </div>
        </div>
        <Button
          onClick={handleGenerateReport}
          disabled={generateReport.isPending}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
        >
          {generateReport.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Generate Today&apos;s Report
        </Button>
      </div>

      {/* Reports List */}
      <Card className="border-purple-500/20">
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>
            Daily summaries with trade activity and P&L
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
                Reports are generated automatically each trading day when the Fine-Tune portfolio is active.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportsData?.reports?.map((report: any) => (
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
    <div className="border rounded-lg overflow-hidden border-purple-500/10">
      {/* Summary Row */}
      <div
        className="flex items-center justify-between p-3 md:p-4 hover:bg-muted/50 cursor-pointer gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Calendar className="h-4 w-4 md:h-5 md:w-5 text-purple-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm md:text-base">
              {new Date(date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.paperTradesOpened} opened · {metrics.paperTradesClosed} closed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">P&L</p>
            <p className={`font-medium text-sm ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
              {isProfitable ? '+' : ''}${totalPnL.toFixed(2)}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">Win</p>
            <p className="font-medium text-sm">{metrics.winRate.toFixed(0)}%</p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t p-3 md:p-4 bg-muted/30 space-y-4">
          {/* Summary */}
          {metrics.summary && (
            <div>
              <h4 className="text-sm font-medium mb-2">Summary</h4>
              <div className="text-sm text-muted-foreground bg-background p-3 rounded-lg border space-y-1">
                {metrics.summary.split('\n').map((line, i) => {
                  if (!line.trim()) return null;
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-semibold text-foreground mt-2 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                  }
                  if (line.startsWith('**')) {
                    const clean = line.replace(/\*\*/g, '');
                    return <p key={i} className="font-medium text-foreground mt-2">{clean}</p>;
                  }
                  return <p key={i} className="mt-1">{line.replace(/\*\*/g, '')}</p>;
                })}
              </div>
            </div>
          )}

          {/* Signals Breakdown */}
          <div>
            <h4 className="text-sm font-medium mb-2">Trade Actions</h4>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-green-500">
                <TrendingUp className="h-3 w-3 mr-1" />
                BUY: {metrics.signalsByAction.BUY}
              </Badge>
              <Badge className="bg-red-500">
                <TrendingDown className="h-3 w-3 mr-1" />
                SELL: {metrics.signalsByAction.SELL}
              </Badge>
            </div>
          </div>

          {/* P&L Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h4 className="text-sm font-medium mb-1">Realized P&L</h4>
              <p className={`text-lg font-medium ${metrics.realizedPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.realizedPnlUsd >= 0 ? '+' : ''}${metrics.realizedPnlUsd.toFixed(2)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Unrealized P&L</h4>
              <p className={`text-lg font-medium ${metrics.unrealizedPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.unrealizedPnlUsd >= 0 ? '+' : ''}${metrics.unrealizedPnlUsd.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Top Performers */}
          {metrics.topPerformers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Top Performers</h4>
              <div className="flex flex-wrap gap-2">
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
                <div className="flex flex-wrap gap-2">
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
        </div>
      )}
    </div>
  );
}
