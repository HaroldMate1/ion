/**
 * Wizard Portfolio Detail API
 * GET – fetch portfolio with enriched holdings and live prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import YahooFinance from 'yahoo-finance2';
import { WIZARD_CONFIGS } from '@/config/wizard-strategies';
import {
  transformWizardPortfolioRow,
  transformWizardHoldingRow,
  type WizardPortfolioRow,
  type WizardHoldingRow,
  type WizardHoldingEnriched,
} from '@/types/wizard-portfolio.types';

const yf = new YahooFinance();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: portfolioRow, error: portfolioError } = await (supabase.from('wizard_portfolio') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolioRow) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const portfolio = transformWizardPortfolioRow(portfolioRow as WizardPortfolioRow);

    const { data: holdingRows, error: holdingsError } = await (supabase.from('wizard_holding') as any)
      .select('*')
      .eq('portfolio_id', id)
      .order('magic_rank', { ascending: true });

    if (holdingsError) {
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    const holdings = (holdingRows || []).map((r: WizardHoldingRow) =>
      transformWizardHoldingRow(r)
    );

    // Fetch buy-transaction notes (one per holding) for Houdini badge display
    const { data: txRows } = await (supabase.from('wizard_transaction') as any)
      .select('symbol, notes')
      .eq('portfolio_id', id)
      .eq('transaction_type', 'buy');

    const notesBySymbol: Record<string, string> = {};
    for (const tx of txRows || []) {
      if (tx.notes && !notesBySymbol[tx.symbol]) {
        notesBySymbol[tx.symbol] = tx.notes;
      }
    }

    // Enrich with live prices
    const enriched: WizardHoldingEnriched[] = await Promise.all(
      holdings.map(async (h: ReturnType<typeof transformWizardHoldingRow>) => {
        try {
          const q = await yf.quote(h.symbol) as any;
          const currentPrice: number | null = q?.regularMarketPrice ?? null;
          const currentValue = currentPrice ? h.quantity * currentPrice : null;
          const unrealizedPnL = currentValue != null ? currentValue - h.totalInvested : null;
          const unrealizedPnLPct =
            unrealizedPnL != null && h.totalInvested > 0
              ? (unrealizedPnL / h.totalInvested) * 100
              : null;

          return { ...h, currentPrice, currentValue, unrealizedPnL, unrealizedPnLPct, actualAllocationPct: null, notes: notesBySymbol[h.symbol] ?? null };
        } catch {
          return { ...h, currentPrice: null, currentValue: null, unrealizedPnL: null, unrealizedPnLPct: null, actualAllocationPct: null, notes: notesBySymbol[h.symbol] ?? null };
        }
      })
    );

    const totalHoldingsValue = enriched.reduce((s, h) => s + (h.currentValue ?? h.totalInvested), 0);
    const totalPortfolioValue = totalHoldingsValue + portfolio.cashBalance;
    const totalReturnPct = ((totalPortfolioValue - 100_000) / 100_000) * 100;

    for (const h of enriched) {
      const val = h.currentValue ?? h.totalInvested;
      h.actualAllocationPct = totalPortfolioValue > 0 ? (val / totalPortfolioValue) * 100 : 0;
    }

    const cfg = WIZARD_CONFIGS[portfolio.strategy];

    return NextResponse.json({
      portfolio: {
        ...portfolio,
        totalValue: totalPortfolioValue,
        totalReturnPct,
        displayName: cfg.displayName,
        title: cfg.title,
        description: cfg.description,
        methodology: cfg.methodology,
        filters: cfg.filters,
        holdings: enriched,
      },
    });
  } catch (err) {
    console.error('Wizard portfolio GET [id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}

/**
 * DELETE /api/wizard/portfolios/[id]
 * Wipe all data for this portfolio so the user can re-initialize.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify ownership
    const { data: portfolio } = await (supabase.from('wizard_portfolio') as any)
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

    // Delete in FK order
    await (supabase.from('wizard_transaction') as any).delete().eq('portfolio_id', id);
    await (supabase.from('wizard_holding') as any).delete().eq('portfolio_id', id);
    await (supabase.from('wizard_portfolio') as any).delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Wizard portfolio DELETE error:', err);
    return NextResponse.json({ error: 'Failed to reset portfolio' }, { status: 500 });
  }
}
