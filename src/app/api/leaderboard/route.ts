/**
 * Leaderboard API
 *
 * Returns all portfolios (AI, LLM, Quant, Expert, Benchmark) ranked by total
 * return %. Each entry also includes enough info to power the "copy" modal.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const INITIAL_BALANCE = 100_000;

// ── helpers ───────────────────────────────────────────────────────────────────

function returnPct(totalValue: number) {
  return ((totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
}

/** Sum trades → { totalValue, openPositions } */
function summariseTrades(
  trades: Array<{ size_usd: string | number; pnl_usd: string | number | null; status: string }>,
) {
  const open   = trades.filter(t => t.status === 'open');
  const closed = trades.filter(t => t.status !== 'open');
  const realised    = closed.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0);
  const capitalInUse = open.reduce((s, t) => s + Number(t.size_usd), 0);
  const totalValue   = INITIAL_BALANCE + realised;
  return { totalValue, capitalInUse, openPositions: open.length };
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = user.id;

  const [
    coachTrades, fineTuneTrades, prometheusTrades,
    llmPortfolios, wizardPortfolios, expertPortfolios, benchmarkPortfolios,
  ] = await Promise.all([
    (supabase.from('coach_paper_trade') as any)
      .select('size_usd,pnl_usd,status').eq('user_id', uid),
    (supabase.from('fine_tune_trade') as any)
      .select('size_usd,pnl_usd,status').eq('user_id', uid),
    (supabase.from('prometheus_trade') as any)
      .select('size_usd,pnl_usd,status').eq('user_id', uid),
    (supabase.from('llm_portfolio') as any)
      .select('id,provider,total_value,cash_balance').eq('user_id', uid),
    (supabase.from('wizard_portfolio') as any)
      .select('id,strategy,total_value,cash_balance').eq('user_id', uid),
    (supabase.from('expert_portfolio') as any)
      .select('id,investor_slug,total_value,cash_balance').eq('user_id', uid),
    (supabase.from('benchmark_portfolio') as any)
      .select('id,benchmark_slug,total_value,cash_balance').eq('user_id', uid),
  ]);

  const entries: any[] = [];

  // ── AI trading models ──────────────────────────────────────────────────────

  const aiModels = [
    { key: 'coach',     label: 'Trading Coach',   slug: 'coach',     trades: coachTrades.data || [] },
    { key: 'finetune',  label: 'Fine-Tune Model', slug: 'finetune',  trades: fineTuneTrades.data || [] },
    { key: 'prometheus',label: 'Prometheus',       slug: 'prometheus',trades: prometheusTrades.data || [] },
  ];

  for (const m of aiModels) {
    const { totalValue, openPositions } = summariseTrades(m.trades);
    entries.push({
      id:             m.key,
      name:           m.label,
      category:       'ai',
      categoryLabel:  'AI Trading',
      portfolioType:  m.key,
      slug:           m.slug,
      initialBalance: INITIAL_BALANCE,
      totalValue,
      totalReturnPct:  returnPct(totalValue),
      totalReturnUsd:  totalValue - INITIAL_BALANCE,
      openPositions,
      isInitialized:   m.trades.length > 0,
    });
  }

  // ── LLM portfolios ─────────────────────────────────────────────────────────

  const LLM_NAMES: Record<string, string> = {
    gemini:     'Gemini',
    claude:     'Claude',
    perplexity: 'Perplexity',
    chatgpt:    'ChatGPT',
    grok:       'Grok',
  };

  for (const row of llmPortfolios.data || []) {
    const totalValue = Number(row.total_value) || INITIAL_BALANCE;
    entries.push({
      id:             `llm-${row.provider}`,
      name:           LLM_NAMES[row.provider] || row.provider,
      category:       'llm',
      categoryLabel:  'LLM Model',
      portfolioType:  'llm',
      slug:           row.provider,
      portfolioId:    row.id,
      initialBalance: INITIAL_BALANCE,
      totalValue,
      totalReturnPct:  returnPct(totalValue),
      totalReturnUsd:  totalValue - INITIAL_BALANCE,
      openPositions:   null,
      isInitialized:   true,
    });
  }

  // ── Quantitative screens ───────────────────────────────────────────────────

  const WIZARD_NAMES: Record<string, string> = {
    merlin:  'Merlin',
    houdini: 'Houdini',
  };

  for (const row of wizardPortfolios.data || []) {
    const totalValue = Number(row.total_value) || INITIAL_BALANCE;
    entries.push({
      id:             `wizard-${row.strategy}`,
      name:           WIZARD_NAMES[row.strategy] || row.strategy,
      category:       'quant',
      categoryLabel:  'Quant Screen',
      portfolioType:  'wizard',
      slug:           row.strategy,
      portfolioId:    row.id,
      initialBalance: INITIAL_BALANCE,
      totalValue,
      totalReturnPct:  returnPct(totalValue),
      totalReturnUsd:  totalValue - INITIAL_BALANCE,
      openPositions:   null,
      isInitialized:   true,
    });
  }

  // ── Expert investors ───────────────────────────────────────────────────────

  const EXPERT_NAMES: Record<string, string> = {
    buffett:       'Warren Buffett',
    marks:         'Howard Marks',
    smith:         'Terry Smith',
    druckenmiller: 'Stanley Druckenmiller',
    greenblatt:    'Joel Greenblatt',
    dalio:         'Ray Dalio',
    hempton:       'John Hempton',
    asness:        'Cliff Asness',
    burry:         'Michael Burry',
    pabrai:        'Mohnish Pabrai',
    pelosi:        'Nancy Pelosi',
    wood:          'Cathie Wood',
  };

  for (const row of expertPortfolios.data || []) {
    const totalValue = Number(row.total_value) || INITIAL_BALANCE;
    entries.push({
      id:             `expert-${row.investor_slug}`,
      name:           EXPERT_NAMES[row.investor_slug] || row.investor_slug,
      category:       'expert',
      categoryLabel:  'Expert Investor',
      portfolioType:  'expert',
      slug:           row.investor_slug,
      portfolioId:    row.id,
      initialBalance: INITIAL_BALANCE,
      totalValue,
      totalReturnPct:  returnPct(totalValue),
      totalReturnUsd:  totalValue - INITIAL_BALANCE,
      openPositions:   null,
      isInitialized:   true,
    });
  }

  // ── Benchmarks ─────────────────────────────────────────────────────────────

  const BENCHMARK_NAMES: Record<string, string> = {
    spy: 'S&P 500 (SPY)',
    qqq: 'Nasdaq 100 (QQQ)',
    dia: 'Dow Jones (DIA)',
    iwm: 'Russell 2000 (IWM)',
    vti: 'Total Market (VTI)',
  };

  for (const row of benchmarkPortfolios.data || []) {
    const totalValue = Number(row.total_value) || INITIAL_BALANCE;
    entries.push({
      id:             `benchmark-${row.benchmark_slug}`,
      name:           BENCHMARK_NAMES[row.benchmark_slug] || row.benchmark_slug.toUpperCase(),
      category:       'benchmark',
      categoryLabel:  'Benchmark',
      portfolioType:  'benchmark',
      slug:           row.benchmark_slug,
      portfolioId:    row.id,
      initialBalance: INITIAL_BALANCE,
      totalValue,
      totalReturnPct:  returnPct(totalValue),
      totalReturnUsd:  totalValue - INITIAL_BALANCE,
      openPositions:   null,
      isInitialized:   true,
    });
  }

  // ── Sort by return ─────────────────────────────────────────────────────────
  entries.sort((a, b) => b.totalReturnPct - a.totalReturnPct);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return NextResponse.json({ entries, updatedAt: new Date().toISOString() });
}
