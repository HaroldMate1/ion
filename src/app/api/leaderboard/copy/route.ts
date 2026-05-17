/**
 * Copy Portfolio — Batch Buy
 *
 * Fetches the open positions / holdings of a given portfolio and returns them
 * as a normalised list of { symbol, assetType, market, assetName, allocationPct }
 * so the client can preview before executing.
 *
 * POST /api/leaderboard/copy
 * Body: { portfolioType, slug, portfolioId?, allocateCash }
 * → executes buys proportional to allocateCash for each position
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMarketQuote } from '@/lib/api/market-data';

export interface CopyPosition {
  symbol:        string;
  assetName:     string;
  assetType:     string;
  market:        string;
  allocationPct: number; // % of total portfolio
}

// ── GET: return positions of a portfolio ──────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type        = request.nextUrl.searchParams.get('type') || '';
  const slug        = request.nextUrl.searchParams.get('slug') || '';
  const portfolioId = request.nextUrl.searchParams.get('portfolioId') || '';
  const uid = user.id;

  let positions: CopyPosition[] = [];

  if (type === 'coach') {
    const { data } = await (supabase.from('coach_paper_trade') as any)
      .select('symbol,size_usd,side,notes')
      .eq('user_id', uid).eq('status', 'open');
    positions = normaliseTrades(data || []);
  }

  else if (type === 'finetune') {
    const { data } = await (supabase.from('fine_tune_trade') as any)
      .select('symbol,size_usd,side,notes')
      .eq('user_id', uid).eq('status', 'open');
    positions = normaliseTrades(data || []);
  }

  else if (type === 'prometheus') {
    const { data } = await (supabase.from('prometheus_trade') as any)
      .select('symbol,size_usd,side,drug_name')
      .eq('user_id', uid).eq('status', 'open');
    positions = normaliseTrades(data || [], 'drug_name');
  }

  else if (type === 'llm' && portfolioId) {
    const { data } = await (supabase.from('llm_holding') as any)
      .select('symbol,asset_type,total_invested')
      .eq('portfolio_id', portfolioId);
    positions = normaliseHoldings(data || []);
  }

  else if (type === 'wizard' && portfolioId) {
    const { data } = await (supabase.from('wizard_holding') as any)
      .select('symbol,asset_name,quantity,total_invested,target_allocation_pct')
      .eq('portfolio_id', portfolioId);
    positions = normaliseWizardHoldings(data || []);
  }

  else if (type === 'expert' && portfolioId) {
    const { data } = await (supabase.from('expert_holding') as any)
      .select('symbol,quantity,total_invested,target_allocation_pct')
      .eq('portfolio_id', portfolioId);
    positions = normaliseExpertHoldings(data || []);
  }

  else if (type === 'benchmark' && portfolioId) {
    const { data } = await (supabase.from('benchmark_holding') as any)
      .select('symbol,asset_name,quantity,total_invested,target_allocation_pct')
      .eq('portfolio_id', portfolioId);
    positions = normaliseWizardHoldings(data || []);
  }

  return NextResponse.json({ positions });
}

// ── POST: execute batch buys ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { positions, allocateCash }: { positions: CopyPosition[]; allocateCash: number } = body;

  if (!positions?.length || !allocateCash || allocateCash <= 0) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Check available cash
  const { data: balance } = await (supabase.from('balances') as any)
    .select('available_cash,total_invested')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!balance || Number(balance.available_cash) < allocateCash) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }

  const results: { symbol: string; success: boolean; error?: string; quantity?: number }[] = [];
  let remainingCash = Number(balance.available_cash);
  let totalInvested = Number(balance.total_invested);

  for (const pos of positions) {
    if (pos.allocationPct <= 0) continue;

    const dollarsForPosition = (pos.allocationPct / 100) * allocateCash;
    if (dollarsForPosition < 1) continue;

    try {
      const quote = await getMarketQuote(pos.symbol, pos.assetType as any, pos.market as any);
      if (!quote || !quote.price || quote.price <= 0) {
        results.push({ symbol: pos.symbol, success: false, error: 'No price' });
        continue;
      }

      const fee       = dollarsForPosition * 0.001;
      const totalCost = dollarsForPosition + fee;
      if (remainingCash < totalCost) {
        results.push({ symbol: pos.symbol, success: false, error: 'Insufficient cash' });
        continue;
      }

      const quantity = dollarsForPosition / quote.price;

      // Check existing holding
      const { data: existing } = await (supabase.from('portfolios') as any)
        .select('quantity,total_invested')
        .eq('user_id', user.id)
        .eq('symbol', pos.symbol)
        .eq('asset_type', pos.assetType)
        .eq('market', pos.market)
        .maybeSingle();

      const newQty         = (Number(existing?.quantity) || 0) + quantity;
      const newTotalInv    = (Number(existing?.total_invested) || 0) + dollarsForPosition;
      const newAvgPrice    = newTotalInv / newQty;

      await (supabase.from('portfolios') as any).upsert({
        user_id: user.id,
        symbol: pos.symbol,
        asset_type: pos.assetType,
        asset_name: pos.assetName,
        market: pos.market,
        quantity: newQty,
        average_buy_price: newAvgPrice,
        total_invested: newTotalInv,
      }, { onConflict: 'user_id,symbol,asset_type,market' });

      await supabase.from('transactions').insert({
        user_id: user.id,
        symbol: pos.symbol,
        asset_type: pos.assetType,
        asset_name: pos.assetName,
        transaction_type: 'buy',
        quantity,
        price_per_unit: quote.price,
        total_amount: dollarsForPosition,
        fee,
        market: pos.market,
      });

      remainingCash -= totalCost;
      totalInvested += dollarsForPosition;
      results.push({ symbol: pos.symbol, success: true, quantity });
    } catch (err: any) {
      results.push({ symbol: pos.symbol, success: false, error: err.message });
    }
  }

  // Update balance once
  await (supabase.from('balances') as any)
    .update({ available_cash: remainingCash, total_invested: totalInvested })
    .eq('user_id', user.id);

  const succeeded = results.filter(r => r.success).length;
  return NextResponse.json({ success: true, bought: succeeded, total: positions.length, results });
}

// ── normalisation helpers ─────────────────────────────────────────────────────

function normaliseTrades(trades: any[], nameField = 'notes'): CopyPosition[] {
  if (!trades.length) return [];
  const total = trades.reduce((s, t) => s + Number(t.size_usd), 0);
  return trades.map(t => ({
    symbol:        t.symbol,
    assetName:     t[nameField] ? String(t[nameField]).split('.')[0] : t.symbol,
    assetType:     t.asset_type || 'stock',
    market:        t.market || 'us',
    allocationPct: total > 0 ? (Number(t.size_usd) / total) * 100 : 0,
  }));
}

function normaliseHoldings(holdings: any[]): CopyPosition[] {
  if (!holdings.length) return [];
  const total = holdings.reduce((s, h) => s + Number(h.total_invested), 0);
  return holdings.map(h => ({
    symbol:        h.symbol,
    assetName:     h.asset_name || h.symbol,
    assetType:     h.asset_type || 'stock',
    market:        h.market || 'us',
    allocationPct: total > 0 ? (Number(h.total_invested) / total) * 100 : 0,
  }));
}

function normaliseWizardHoldings(holdings: any[]): CopyPosition[] {
  if (!holdings.length) return [];
  const total = holdings.reduce((s, h) => s + Number(h.target_allocation_pct || h.total_invested || 0), 0);
  return holdings.map(h => {
    const weight = h.target_allocation_pct
      ? Number(h.target_allocation_pct)
      : (Number(h.total_invested) || 0);
    return {
      symbol:        h.symbol,
      assetName:     h.asset_name || h.symbol,
      assetType:     'stock',
      market:        'us',
      allocationPct: total > 0 ? (weight / total) * 100 : 0,
    };
  });
}

function normaliseExpertHoldings(holdings: any[]): CopyPosition[] {
  return normaliseWizardHoldings(holdings.map(h => ({ ...h, asset_name: h.symbol })));
}
