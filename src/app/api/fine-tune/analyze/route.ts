/**
 * Fine-Tune Portfolio Analyze API
 * POST – monitor open positions (close SL/TP hits), then run analysis
 *        with fine-tuned weights and auto-execute new trades into fine_tune_trade.
 *        Completely independent from the Coach portfolio.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runBatchAnalysis, parseWatchSymbol } from '@/lib/coach/engine/coachEngine';
import { fetchMarketData } from '@/lib/coach/autonomousRunner';
import { DEFAULT_COACH_CONFIG } from '@/lib/coach/types';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const INITIAL_BALANCE = 100_000;

// Pharma/biotech universe for live trading (55 stocks)
const FINE_TUNE_WATCH = [
  // US Large-Cap Pharma
  'JNJ','PFE','MRK','ABBV','LLY','BMY','TMO','ABT','DHR','SYK','BDX','ZTS','BAX','VTRS',
  // US Biotech
  'AMGN','GILD','REGN','VRTX','BIIB','MRNA','BNTX','INCY','ALNY','BMRN','SGEN',
  'EXEL','HALO','UTHR','NBIX','PCVX','SRPT','RARE','IONS','PTCT','INSM','MEDP',
  // International ADRs
  'AZN','NVO','GSK','SNY','NVS','RHHBY','BAYRY','TAK','ARGX','HLN','ZLAB',
  'RDY','TEVA','ALVO','LEGN','BHC','CTLT','IQV','CRL',
];

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Load fine-tune config
    const { data: configRow } = await (supabase.from('fine_tune_config') as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configRow?.kill_switch) {
      return NextResponse.json({ success: false, message: 'Kill switch is active' });
    }

    const weights = {
      indicator:   configRow ? Number(configRow.indicator_weight)    : 0.45,
      priceAction: configRow ? Number(configRow.price_action_weight) : 0.45,
      news:        configRow ? Number(configRow.news_weight)         : 0.10,
    };

    // ── 1. Monitor open positions ─────────────────────────────────────────────
    const { data: openTrades } = await (supabase.from('fine_tune_trade') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open');

    for (const trade of openTrades || []) {
      try {
        const q = await yf.quote(trade.symbol) as any;
        const price: number | null = q?.regularMarketPrice ?? null;
        if (!price) continue;

        const sl = trade.stop_loss ? Number(trade.stop_loss) : null;
        const tps: any[] = trade.take_profit_json || [];
        const entry = Number(trade.entry_price);
        let newStatus: string | null = null;

        if (trade.side === 'BUY') {
          if (sl && price <= sl) newStatus = 'stopped';
          else if (tps.length > 0 && price >= tps[tps.length - 1].price) newStatus = 'tp_hit';
        } else {
          if (sl && price >= sl) newStatus = 'stopped';
          else if (tps.length > 0 && price <= tps[tps.length - 1].price) newStatus = 'tp_hit';
        }

        if (newStatus) {
          const pnlUsd = trade.side === 'BUY'
            ? (price - entry) * Number(trade.quantity)
            : (entry - price) * Number(trade.quantity);
          await (supabase.from('fine_tune_trade') as any)
            .update({
              status: newStatus,
              closed_at: new Date().toISOString(),
              exit_price: price,
              pnl_usd: pnlUsd,
              pnl_pct: (pnlUsd / Number(trade.size_usd)) * 100,
            })
            .eq('id', trade.id);
        }
      } catch {
        // Can't get price – skip monitoring for this trade
      }
    }

    // ── 2. Recalculate portfolio state ────────────────────────────────────────
    const { data: allTrades } = await (supabase.from('fine_tune_trade') as any)
      .select('size_usd, pnl_usd, status, symbol')
      .eq('user_id', user.id);

    const stillOpen = (allTrades || []).filter((t: any) => t.status === 'open');
    const closed    = (allTrades || []).filter((t: any) => t.status !== 'open');

    const realizedPnL  = closed.reduce((s: number, t: any) => s + (Number(t.pnl_usd) || 0), 0);
    const capitalInUse = stillOpen.reduce((s: number, t: any) => s + Number(t.size_usd), 0);
    const totalValue   = INITIAL_BALANCE + realizedPnL;
    const availableCash = Math.max(0, totalValue - capitalInUse);

    // ── 3. Run analysis with fine-tune weights ────────────────────────────────
    const config = { ...DEFAULT_COACH_CONFIG, userId: user.id, weights };

    const symbolsToAnalyze = FINE_TUNE_WATCH
      .map(s => parseWatchSymbol(s))
      .filter(Boolean) as ReturnType<typeof parseWatchSymbol>[];

    const portfolioState = {
      totalValue,
      availableCash,
      openPositions: stillOpen.length,
      todayPnL: 0,
      todayPnLPercent: 0,
    };

    const result = await runBatchAnalysis(
      symbolsToAnalyze as any,
      fetchMarketData,
      config,
      portfolioState
    );

    // ── 4. Auto-execute actionable signals ────────────────────────────────────
    const openSymbols = new Set(stillOpen.map((t: any) => t.symbol));
    const executed: { symbol: string; side: string }[] = [];

    for (const signal of result.signals) {
      if (signal.consensusAction === 'HOLD' || !signal.currentPrice || signal.isStale) continue;
      if (openSymbols.has(signal.symbol)) continue;

      const sizeUsd = Math.min(availableCash, totalValue * 0.15);
      if (sizeUsd < 10) break;

      const quantity = sizeUsd / signal.currentPrice;

      await (supabase.from('fine_tune_trade') as any).insert({
        user_id:          user.id,
        symbol:           signal.symbol,
        asset_type:       signal.assetType,
        market:           signal.market,
        side:             signal.consensusAction,
        entry_price:      signal.currentPrice,
        size_usd:         sizeUsd,
        quantity,
        stop_loss:        signal.stopLoss,
        take_profit_json: signal.takeProfitJson,
        status:           'open',
        opened_at:        new Date().toISOString(),
        notes: `Fine-Tune auto. Wts: Ind ${(weights.indicator * 100).toFixed(0)}%/PA ${(weights.priceAction * 100).toFixed(0)}%/News ${(weights.news * 100).toFixed(0)}%. Score: ${((signal.consensusScore || 0) * 100).toFixed(0)}%`,
      });

      openSymbols.add(signal.symbol);
      executed.push({ symbol: signal.symbol, side: signal.consensusAction });
    }

    return NextResponse.json({
      success: true,
      signalsGenerated: result.signals.length,
      tradesExecuted: executed.length,
      executedSymbols: executed.map(e => e.symbol),
    });
  } catch (err) {
    console.error('Fine-tune analyze error:', err);
    return NextResponse.json({ error: 'Failed to run analysis' }, { status: 500 });
  }
}
