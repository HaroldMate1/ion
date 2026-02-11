/**
 * Coach Reports API Route
 * GET - List daily reports
 * POST - Generate report for a date
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReportSchema } from '@/schemas/coach.schema';
import type { DailyReportMetrics } from '@/lib/coach/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Coach tables not in generated types, using 'as any'
    const { data: reports, count, error } = await (supabase
      .from('coach_daily_report') as any)
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    const transformedReports = (reports || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      reportDate: row.report_date,
      metricsJson: row.metrics_json,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      reports: transformedReports,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Coach reports GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = generateReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const reportDate = validation.data.date || new Date().toISOString().split('T')[0];

    // Check if report already exists
    const { data: existing } = await (supabase
      .from('coach_daily_report') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('report_date', reportDate)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Report already exists for this date' },
        { status: 400 }
      );
    }

    // Get signals for the day
    const startOfDay = `${reportDate}T00:00:00Z`;
    const endOfDay = `${reportDate}T23:59:59Z`;

    const { data: signals } = await (supabase
      .from('coach_signal') as any)
      .select('symbol, consensus_action, consensus_score, rationale, current_price')
      .eq('user_id', user.id)
      .gte('signal_ts', startOfDay)
      .lte('signal_ts', endOfDay);

    // Count signals by action and collect rationales
    const signalsByAction = { BUY: 0, SELL: 0, HOLD: 0 };
    const tradeRationales: { symbol: string; action: string; rationale: string }[] = [];
    for (const signal of signals || []) {
      const action = (signal as any).consensus_action as keyof typeof signalsByAction;
      if (signalsByAction[action] !== undefined) {
        signalsByAction[action]++;
      }
      tradeRationales.push({
        symbol: (signal as any).symbol,
        action: (signal as any).consensus_action,
        rationale: (signal as any).rationale || 'No rationale available',
      });
    }

    // Get paper trades for the day
    const { data: openedTrades } = await (supabase
      .from('coach_paper_trade') as any)
      .select('id, symbol, side, entry_price, size_usd')
      .eq('user_id', user.id)
      .gte('opened_at', startOfDay)
      .lte('opened_at', endOfDay);

    const { data: closedTrades } = await (supabase
      .from('coach_paper_trade') as any)
      .select('pnl_usd, pnl_pct, symbol, side, entry_price, exit_price, notes')
      .eq('user_id', user.id)
      .gte('closed_at', startOfDay)
      .lte('closed_at', endOfDay);

    // Calculate realized P&L
    const realizedPnl = (closedTrades || []).reduce(
      (sum: number, t: any) => sum + (parseFloat(t.pnl_usd) || 0),
      0
    );

    // Calculate win rate
    const wins = (closedTrades || []).filter((t: any) => parseFloat(t.pnl_usd) > 0).length;
    const winRate = closedTrades?.length ? (wins / closedTrades.length) * 100 : 0;

    // Get unrealized P&L from open trades
    const { data: openTrades } = await (supabase
      .from('coach_paper_trade') as any)
      .select('pnl_usd')
      .eq('user_id', user.id)
      .eq('status', 'open');

    const unrealizedPnl = (openTrades || []).reduce(
      (sum: number, t: any) => sum + (parseFloat(t.pnl_usd) || 0),
      0
    );

    // Get top and worst performers
    const sortedTrades = [...(closedTrades || [])].sort(
      (a: any, b: any) => parseFloat(b.pnl_pct || '0') - parseFloat(a.pnl_pct || '0')
    );

    const topPerformers = sortedTrades.slice(0, 3).map((t: any) => ({
      symbol: t.symbol,
      pnlPct: parseFloat(t.pnl_pct || '0'),
    }));

    const worstPerformers = sortedTrades
      .slice(-3)
      .reverse()
      .map((t: any) => ({
        symbol: t.symbol,
        pnlPct: parseFloat(t.pnl_pct || '0'),
      }));

    // Check if circuit breaker was triggered
    const { data: config } = await (supabase
      .from('coach_config') as any)
      .select('daily_drawdown_limit_pct')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: balance } = await supabase
      .from('balances')
      .select('available_cash, total_invested')
      .eq('user_id', user.id)
      .maybeSingle();

    const balanceData = balance as any;
    const totalValue =
      (parseFloat(balanceData?.available_cash || '100000') +
        parseFloat(balanceData?.total_invested || '0'));
    const drawdownPct = totalValue > 0 ? (realizedPnl / totalValue) * 100 : 0;
    const dailyLimit = parseFloat((config as any)?.daily_drawdown_limit_pct || '3');
    const circuitBreakerTriggered = drawdownPct <= -dailyLimit;

    // Build summary
    const summaryParts: string[] = [];
    const dateStr = new Date(reportDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    summaryParts.push(`**Daily Market Report - ${dateStr}**`);
    summaryParts.push(
      `\nToday the coach analyzed ${(signals || []).length} symbol${(signals || []).length !== 1 ? 's' : ''} and generated ${signalsByAction.BUY} buy, ${signalsByAction.SELL} sell, and ${signalsByAction.HOLD} hold signal${signalsByAction.HOLD !== 1 ? 's' : ''}.`
    );

    if ((openedTrades || []).length > 0) {
      const tradeList = (openedTrades || []).map((t: any) =>
        `${t.side} ${t.symbol} at $${parseFloat(t.entry_price).toFixed(2)} ($${parseFloat(t.size_usd).toFixed(0)})`
      ).join(', ');
      summaryParts.push(`\n**Trades Executed:** ${tradeList}`);
    }

    if ((closedTrades || []).length > 0) {
      const closeList = (closedTrades || []).map((t: any) => {
        const pnl = parseFloat(t.pnl_usd || '0');
        return `${t.symbol} ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
      }).join(', ');
      summaryParts.push(`\n**Trades Closed:** ${closeList}`);
      summaryParts.push(`Realized P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} | Win rate: ${winRate.toFixed(0)}%`);
    }

    const buyRationales = tradeRationales.filter(r => r.action === 'BUY');
    const sellRationales = tradeRationales.filter(r => r.action === 'SELL');
    const holdRationales = tradeRationales.filter(r => r.action === 'HOLD');

    if (buyRationales.length > 0) {
      summaryParts.push('\n**Why we bought:**');
      for (const s of buyRationales.slice(0, 5)) {
        summaryParts.push(`- **${s.symbol}**: ${s.rationale}`);
      }
    }
    if (sellRationales.length > 0) {
      summaryParts.push('\n**Why we sold:**');
      for (const s of sellRationales.slice(0, 5)) {
        summaryParts.push(`- **${s.symbol}**: ${s.rationale}`);
      }
    }
    if (holdRationales.length > 0 && holdRationales.length <= 5) {
      summaryParts.push('\n**Why we held:**');
      for (const s of holdRationales) {
        summaryParts.push(`- **${s.symbol}**: ${s.rationale}`);
      }
    } else if (holdRationales.length > 5) {
      summaryParts.push(`\n**Hold signals:** ${holdRationales.length} symbols held — no strong conviction to enter or exit.`);
    }

    const summary = summaryParts.join('\n');

    const metrics: DailyReportMetrics = {
      signalsGenerated: signals?.length || 0,
      signalsByAction,
      paperTradesOpened: openedTrades?.length || 0,
      paperTradesClosed: closedTrades?.length || 0,
      realizedPnlUsd: Math.round(realizedPnl * 100) / 100,
      unrealizedPnlUsd: Math.round(unrealizedPnl * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      avgRiskReward: 0,
      topPerformers,
      worstPerformers,
      circuitBreakerTriggered,
      summary,
      tradeRationales,
    };

    // Save report
    const { data: report, error } = await (supabase
      .from('coach_daily_report') as any)
      .insert({
        user_id: user.id,
        report_date: reportDate,
        metrics_json: metrics,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      );
    }

    const reportData = report as any;

    return NextResponse.json({
      success: true,
      report: {
        id: reportData.id,
        userId: reportData.user_id,
        reportDate: reportData.report_date,
        metricsJson: reportData.metrics_json,
        createdAt: reportData.created_at,
      },
    });
  } catch (error) {
    console.error('Coach reports POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
