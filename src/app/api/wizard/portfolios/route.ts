/**
 * Wizard Portfolios API
 * GET  – list both portfolios (Merlin & Houdini) with live P&L
 * POST – initialize a portfolio: screen stocks → buy top 30
 *
 * Merlin : Pure Magic Formula (Greenblatt) — rank by Earnings Yield + ROE.
 * Houdini: Magic Formula + elite pre-filter (profitability, balance-sheet,
 *           consistency, valuation, quality composites, momentum/sentiment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import YahooFinance from 'yahoo-finance2';
import {
  WIZARD_STRATEGIES,
  WIZARD_CONFIGS,
  WIZARD_STOCK_UNIVERSE,
  INITIAL_WIZARD_BALANCE,
  WIZARD_TOP_N,
  type WizardStrategy,
} from '@/config/wizard-strategies';
import {
  transformWizardPortfolioRow,
  type WizardPortfolioRow,
} from '@/types/wizard-portfolio.types';

const yf = new YahooFinance();

// ─── Data shape ───────────────────────────────────────────────────────────────

interface ScreenedStock {
  symbol: string;
  name: string;
  price: number;

  // ── Magic Formula ranking inputs (Merlin + Houdini) ──────────────────────
  peRatio: number;
  earningsYield: number;        // 1 / P/E
  returnOnEquity: number;       // trailing ROE (for ranking)

  // ── Profitability ─────────────────────────────────────────────────────────
  operatingMargin: number | null;
  grossMargin: number | null;
  fcfMargin: number | null;     // FCF / revenue

  // ── Debt ─────────────────────────────────────────────────────────────────
  netDebtEbitda: number | null; // (totalDebt – cash) / EBITDA
  interestCoverage: number | null; // EBIT / |interestExpense|

  // ── Consistency (from annual history, typically 4 years) ─────────────────
  totalHistoryYears: number;
  revenueCagr: number | null;
  epsCagr: number | null;       // net-income CAGR as proxy
  epsPositiveYears: number;     // years with positive net income
  fcfPositiveYears: number;     // years with positive FCF
  revenueDeclineYears: number;  // years where revenue fell YoY

  // ── Valuation ────────────────────────────────────────────────────────────
  pegRatio: number | null;
  evEbit: number | null;        // EV / EBIT
  fcfYield: number | null;      // FCF / market cap
  dcfGap: number | null;        // (DCF value – price) / price; positive = undervalued

  // ── Quality composites ────────────────────────────────────────────────────
  piotroskiScore: number;       // 0–8 (dilution signal skipped)
  altmanZ: number | null;

  // ── Momentum / Sentiment ─────────────────────────────────────────────────
  institutionalOwnership: number | null; // 0–1 decimal
  above200dMA: boolean | null;

  // Set after ranking
  combinedRank: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Compound annual growth rate from chronologically-ordered values (oldest→newest). */
function computeCagr(values: number[]): number | null {
  if (values.length < 2) return null;
  const oldest = values[0];
  const newest = values[values.length - 1];
  if (oldest <= 0 || newest <= 0) return null;
  return Math.pow(newest / oldest, 1 / (values.length - 1)) - 1;
}

/**
 * DCF intrinsic value using AVERAGE historical FCF (more stable than trailing alone).
 * Growth: capped historical CAGR (2–15%).  WACC: 10%.  Terminal growth: 3%.
 * Returns (dcf_value – price) / price; positive = stock is undervalued.
 */
function computeDcfGap(
  historicalFcfs: number[],     // chronological, positive-only entries
  sharesOutstanding: number,
  marketPrice: number,
  revenueCagr: number | null,
): number | null {
  if (!historicalFcfs.length || sharesOutstanding <= 0 || marketPrice <= 0) return null;

  const avgFcf = historicalFcfs.reduce((s, v) => s + v, 0) / historicalFcfs.length;
  const fcfPerShare = avgFcf / sharesOutstanding;
  if (fcfPerShare <= 0) return null;

  const growthRate = Math.min(Math.max(revenueCagr ?? 0.05, 0.02), 0.15);
  const wacc = 0.10;
  const terminalGrowth = 0.03;

  let dcfValue = 0;
  let fcf = fcfPerShare;
  for (let yr = 1; yr <= 5; yr++) {
    fcf *= 1 + growthRate;
    dcfValue += fcf / Math.pow(1 + wacc, yr);
  }
  dcfValue += (fcf * (1 + terminalGrowth)) / (wacc - terminalGrowth) / Math.pow(1 + wacc, 5);

  return (dcfValue - marketPrice) / marketPrice;
}

/**
 * Piotroski F-Score (0–8; the share-dilution signal is omitted).
 * Requires at least 2 years of each statement.
 */
function computePiotroski(
  incomeStmts: any[],   // newest-first
  balanceSheets: any[], // newest-first
  cashflows: any[],     // newest-first
): number {
  let score = 0;
  if (incomeStmts.length < 2 || balanceSheets.length < 2) return 0;

  const [inc0, inc1] = incomeStmts;
  const [bs0, bs1] = balanceSheets;
  const cf0 = cashflows[0];

  const ta0 = bs0?.totalAssets;
  const ta1 = bs1?.totalAssets;
  const ocf0 = cf0?.totalCashFromOperatingActivities;

  // 1. ROA > 0
  if (inc0?.netIncome && ta0 && inc0.netIncome / ta0 > 0) score++;

  // 2. Operating cash flow > 0
  if (ocf0 > 0) score++;

  // 3. Improving ROA
  if (inc0?.netIncome && inc1?.netIncome && ta0 && ta1) {
    if (inc0.netIncome / ta0 > inc1.netIncome / ta1) score++;
  }

  // 4. Accruals: OCF > Net Income (quality of earnings)
  if (ocf0 != null && inc0?.netIncome != null && ocf0 > inc0.netIncome) score++;

  // 5. Leverage decreased (long-term debt / total assets)
  if (ta0 && ta1) {
    const ltd0 = bs0?.longTermDebt ?? 0;
    const ltd1 = bs1?.longTermDebt ?? 0;
    if (ltd0 / ta0 <= ltd1 / ta1) score++;
  }

  // 6. Current ratio improved
  if (bs0?.totalCurrentAssets && bs0?.totalCurrentLiabilities &&
      bs1?.totalCurrentAssets && bs1?.totalCurrentLiabilities) {
    if (bs0.totalCurrentAssets / bs0.totalCurrentLiabilities >
        bs1.totalCurrentAssets / bs1.totalCurrentLiabilities) score++;
  }

  // 7. Gross margin improved
  if (inc0?.grossProfit && inc0?.totalRevenue && inc1?.grossProfit && inc1?.totalRevenue) {
    if (inc0.grossProfit / inc0.totalRevenue > inc1.grossProfit / inc1.totalRevenue) score++;
  }

  // 8. Asset turnover improved
  if (inc0?.totalRevenue && ta0 && inc1?.totalRevenue && ta1) {
    if (inc0.totalRevenue / ta0 > inc1.totalRevenue / ta1) score++;
  }

  return score;
}

/**
 * Altman Z-Score for publicly listed manufacturers / general companies.
 * Z > 3.0 → safe zone.  1.8–3.0 → grey.  < 1.8 → distress.
 */
function computeAltmanZ(
  income: any,
  balanceSheet: any,
  marketCap: number,
): number | null {
  if (!income || !balanceSheet || marketCap <= 0) return null;

  const ta = balanceSheet.totalAssets;
  if (!ta || ta <= 0) return null;

  const wc = (balanceSheet.totalCurrentAssets ?? 0) - (balanceSheet.totalCurrentLiabilities ?? 0);
  const re = balanceSheet.retainedEarnings ?? 0;
  const ebit = income.ebit ?? income.operatingIncome ?? 0;
  const totalLiab =
    balanceSheet.totalLiabilities ??
    (ta - (balanceSheet.totalStockholdersEquity ?? 0));
  const revenue = income.totalRevenue ?? 0;

  if (!totalLiab || totalLiab <= 0) return null;

  return (
    1.2 * (wc / ta) +
    1.4 * (re / ta) +
    3.3 * (ebit / ta) +
    0.6 * (marketCap / totalLiab) +
    1.0 * (revenue / ta)
  );
}

// ─── Main data-fetch ──────────────────────────────────────────────────────────

/** Fetch all financial data for one symbol; returns null on any hard error. */
async function fetchStockData(symbol: string): Promise<ScreenedStock | null> {
  try {
    const [summary, quote] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: [
          'financialData',
          'defaultKeyStatistics',
          'summaryDetail',
          'price',
          'incomeStatementHistory',
          'balanceSheetHistory',
          'cashflowStatementHistory',
        ],
      }),
      yf.quote(symbol) as Promise<any>,
    ]);

    const fd  = summary.financialData;
    const ks  = summary.defaultKeyStatistics;
    const sd  = summary.summaryDetail;
    const pr  = summary.price;

    // ── Price ──────────────────────────────────────────────────────────────
    const price: number | null = (quote?.regularMarketPrice ?? pr?.regularMarketPrice) ?? null;
    if (!price || price <= 0) return null;

    // ── P/E & earnings yield (required for ranking) ───────────────────────
    let trailingPE: number | null = (sd?.trailingPE as number | undefined) ?? null;
    if (!trailingPE && ks?.trailingEps != null && price > 0) {
      trailingPE = price / Number(ks.trailingEps);
    }
    if (!trailingPE || trailingPE <= 0 || trailingPE > 200) return null;
    const earningsYield = 1 / trailingPE;

    // ── ROE (required for ranking — must be positive) ─────────────────────
    const roe = fd?.returnOnEquity != null ? Number(fd.returnOnEquity) : null;
    if (roe == null || roe <= 0) return null;

    // ── Market cap & shares outstanding ──────────────────────────────────
    const sharesOutstanding: number | null =
      (ks?.sharesOutstanding ?? pr?.sharesOutstanding) != null
        ? Number(ks?.sharesOutstanding ?? pr?.sharesOutstanding)
        : null;
    const marketCap: number | null =
      pr?.marketCap != null ? Number(pr.marketCap) :
      sharesOutstanding ? sharesOutstanding * price : null;

    // ── Historical statements ─────────────────────────────────────────────
    // Yahoo Finance returns newest-first
    const incomeStmts: any[] = (summary.incomeStatementHistory as any)?.incomeStatementHistory ?? [];
    const balanceSheets: any[] = (summary.balanceSheetHistory as any)?.balanceSheetStatements ?? [];
    const cashflows: any[] = (summary.cashflowStatementHistory as any)?.cashflowStatements ?? [];

    const latestInc = incomeStmts[0];
    const latestBS  = balanceSheets[0];
    const latestCF  = cashflows[0];

    // ── Profitability ─────────────────────────────────────────────────────
    const operatingMargin =
      fd?.operatingMargins != null ? Number(fd.operatingMargins) :
      latestInc?.ebit && latestInc?.totalRevenue
        ? latestInc.ebit / latestInc.totalRevenue : null;

    const grossMargin =
      (fd as any)?.grossMargins != null ? Number((fd as any).grossMargins) :
      latestInc?.grossProfit && latestInc?.totalRevenue
        ? latestInc.grossProfit / latestInc.totalRevenue : null;

    const totalRevenue = fd?.totalRevenue != null ? Number(fd.totalRevenue) :
      latestInc?.totalRevenue ?? null;

    const trailingFcf = fd?.freeCashflow != null ? Number(fd.freeCashflow) :
      latestCF?.freeCashflow != null ? latestCF.freeCashflow :
      latestCF?.totalCashFromOperatingActivities != null
        ? latestCF.totalCashFromOperatingActivities + (latestCF.capitalExpenditures ?? 0)
        : null;

    const fcfMargin =
      trailingFcf != null && totalRevenue && totalRevenue > 0
        ? trailingFcf / totalRevenue : null;

    // ── Debt ─────────────────────────────────────────────────────────────
    const totalDebt = fd?.totalDebt != null ? Number(fd.totalDebt) :
      latestBS?.longTermDebt != null
        ? latestBS.longTermDebt + (latestBS.shortLongTermDebt ?? 0) : null;

    const totalCash = fd?.totalCash != null ? Number(fd.totalCash) :
      latestBS?.cash != null
        ? latestBS.cash + (latestBS.shortTermInvestments ?? 0) : null;

    const ebitda = fd?.ebitda != null ? Number(fd.ebitda) : null;

    const netDebtEbitda =
      totalDebt != null && totalCash != null && ebitda && ebitda > 0
        ? (totalDebt - totalCash) / ebitda : null;

    const interestExpense = latestInc?.interestExpense ?? null;
    const ebit = latestInc?.ebit ?? null;
    const interestCoverage =
      ebit != null && interestExpense != null && interestExpense !== 0
        ? ebit / Math.abs(interestExpense) : null;

    // ── Consistency (from annual history) ─────────────────────────────────
    const totalHistoryYears = incomeStmts.length;

    // Revenue array (oldest → newest)
    const revenues: number[] = [...incomeStmts]
      .reverse()
      .map((s: any) => s.totalRevenue)
      .filter((v): v is number => v != null && v > 0);

    const revenueCagr = computeCagr(revenues);

    // Count YoY revenue declines
    let revenueDeclineYears = 0;
    for (let i = 1; i < revenues.length; i++) {
      if (revenues[i] < revenues[i - 1]) revenueDeclineYears++;
    }

    // Net income (EPS proxy) — oldest → newest
    const netIncomes: number[] = [...incomeStmts]
      .reverse()
      .map((s: any) => s.netIncome)
      .filter((v): v is number => v != null);

    const epsPositiveYears = netIncomes.filter((v) => v > 0).length;
    const epsCagr = computeCagr(netIncomes.filter((v) => v > 0).length === netIncomes.length
      ? netIncomes : []);  // only compute CAGR if all years positive

    // FCF per year (newest-first, then reverse for chronological)
    const historicalFcfs: number[] = [...cashflows]
      .reverse()
      .map((cf: any) => {
        const fcf =
          cf.freeCashflow ??
          (cf.totalCashFromOperatingActivities != null
            ? cf.totalCashFromOperatingActivities + (cf.capitalExpenditures ?? 0)
            : null);
        return fcf;
      })
      .filter((v): v is number => v != null && v > 0); // positive only

    const fcfPositiveYears = [...cashflows].filter((cf: any) => {
      const fcf = cf.freeCashflow ??
        (cf.totalCashFromOperatingActivities != null
          ? cf.totalCashFromOperatingActivities + (cf.capitalExpenditures ?? 0)
          : null);
      return fcf != null && fcf > 0;
    }).length;

    // ── Valuation ─────────────────────────────────────────────────────────
    const pegRatio = ks?.pegRatio != null ? Number(ks.pegRatio) : null;

    const enterpriseValue = ks?.enterpriseValue != null ? Number(ks.enterpriseValue) : null;
    const evEbit =
      enterpriseValue && ebit && ebit > 0
        ? enterpriseValue / ebit : null;

    const fcfYield =
      trailingFcf != null && marketCap && marketCap > 0
        ? trailingFcf / marketCap : null;

    const dcfGap = sharesOutstanding
      ? computeDcfGap(historicalFcfs, sharesOutstanding, price, revenueCagr)
      : null;

    // ── Quality composites ────────────────────────────────────────────────
    const piotroskiScore = computePiotroski(incomeStmts, balanceSheets, cashflows);

    const altmanZ =
      latestInc && latestBS && marketCap
        ? computeAltmanZ(latestInc, latestBS, marketCap)
        : null;

    // ── Momentum / Sentiment ──────────────────────────────────────────────
    const institutionalOwnership =
      ks?.heldPercentInstitutions != null ? Number(ks.heldPercentInstitutions) : null;

    const twoHundredDayAvg: number | null = quote?.twoHundredDayAverage ?? null;
    const above200dMA =
      twoHundredDayAvg != null ? price >= twoHundredDayAvg : null;

    // ── Name ─────────────────────────────────────────────────────────────
    const name = String(
      (quote as any)?.shortName ?? (quote as any)?.longName ?? pr?.shortName ?? symbol
    );

    return {
      symbol,
      name,
      price,
      peRatio: trailingPE,
      earningsYield,
      returnOnEquity: roe,
      operatingMargin,
      grossMargin,
      fcfMargin,
      netDebtEbitda,
      interestCoverage,
      totalHistoryYears,
      revenueCagr,
      epsCagr,
      epsPositiveYears,
      fcfPositiveYears,
      revenueDeclineYears,
      pegRatio,
      evEbit,
      fcfYield,
      dcfGap,
      piotroskiScore,
      altmanZ,
      institutionalOwnership,
      above200dMA,
      combinedRank: 0,
    };
  } catch {
    return null;
  }
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/** Rank by combined Earnings-Yield rank + ROE rank (lower combined = better). */
function rankStocks(stocks: ScreenedStock[]): ScreenedStock[] {
  const sorted = [...stocks];

  const byEY  = [...sorted].sort((a, b) => b.earningsYield - a.earningsYield);
  const byROE = [...sorted].sort((a, b) => b.returnOnEquity - a.returnOnEquity);
  const eyRank  = new Map(byEY.map((s, i) => [s.symbol, i + 1]));
  const roeRank = new Map(byROE.map((s, i) => [s.symbol, i + 1]));

  for (const s of sorted) {
    s.combinedRank = (eyRank.get(s.symbol) ?? 999) + (roeRank.get(s.symbol) ?? 999);
  }

  return sorted.sort((a, b) => a.combinedRank - b.combinedRank);
}

// ─── Houdini pre-filter ───────────────────────────────────────────────────────

/**
 * Elite quality gate applied before Magic Formula ranking.
 * Any filter is SKIPPED (not failed) when its data is unavailable (null).
 */
function applyHoudiniFilters(stocks: ScreenedStock[]): ScreenedStock[] {
  return stocks.filter((s) => {

    // ── PROFITABILITY — elite capital allocators only ─────────────────────
    // ROE ≥ 20%  (already positive by fetchStockData; raise bar here)
    if (s.returnOnEquity < 0.20) return false;
    // Operating margin ≥ 20%
    if (s.operatingMargin !== null && s.operatingMargin < 0.20) return false;
    // Gross margin ≥ 50% — highly differentiated products/services
    if (s.grossMargin !== null && s.grossMargin < 0.50) return false;
    // FCF margin ≥ 15% — profits actually convert to cash
    if (s.fcfMargin !== null && s.fcfMargin < 0.15) return false;

    // ── DEBT — near fortress balance sheets ──────────────────────────────
    // Net Debt / EBITDA < 1× (near-zero leverage)
    if (s.netDebtEbitda !== null && s.netDebtEbitda >= 1.0) return false;
    // Interest coverage ≥ 15× — debt service is operationally irrelevant
    if (s.interestCoverage !== null && s.interestCoverage < 15) return false;

    // ── CONSISTENCY — no lucky snapshots ─────────────────────────────────
    // Revenue CAGR ≥ 10% (over available history, minimum 4 yrs required)
    if (s.revenueCagr !== null && s.revenueCagr < 0.10) return false;
    // EPS (net income) positive in ALL available years — zero tolerance for losses
    if (s.totalHistoryYears >= 2 && s.epsPositiveYears < s.totalHistoryYears) return false;
    // EPS CAGR ≥ 10%
    if (s.epsCagr !== null && s.epsCagr < 0.10) return false;
    // FCF positive in ALL available years — no cash-burn years
    if (s.totalHistoryYears >= 2 && s.fcfPositiveYears < s.totalHistoryYears) return false;
    // Revenue declined in at most 1 of the last N years
    if (s.revenueDeclineYears > 1) return false;

    // ── VALUATION — only buy at fair price or better ─────────────────────
    // PEG ≤ 1.5 — growth must be reasonably priced
    if (s.pegRatio !== null && s.pegRatio > 1.5) return false;
    // EV / EBIT < 18×
    if (s.evEbit !== null && s.evEbit >= 18) return false;
    // FCF yield ≥ 3% — real cash return on purchase price
    if (s.fcfYield !== null && s.fcfYield < 0.03) return false;
    // DCF: stock not trading more than 20% above intrinsic value
    if (s.dcfGap !== null && s.dcfGap < -0.20) return false;

    // ── QUALITY COMPOSITES ────────────────────────────────────────────────
    // Piotroski F-Score ≥ 7 / 8 (1 signal may be missing data)
    if (s.totalHistoryYears >= 2 && s.piotroskiScore < 7) return false;
    // Altman Z ≥ 3.0 — statistically near-zero bankruptcy risk
    if (s.altmanZ !== null && s.altmanZ < 3.0) return false;

    // ── MOMENTUM / SENTIMENT ─────────────────────────────────────────────
    // Institutional ownership ≥ 30% — smart money is present
    if (s.institutionalOwnership !== null && s.institutionalOwnership < 0.30) return false;
    // Price above 200-day moving average — market confirms the business is working
    if (s.above200dMA === false) return false;

    return true;
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: rows } = await (supabase.from('wizard_portfolio') as any)
      .select('*')
      .eq('user_id', user.id);

    const existing = (rows || []).map((r: WizardPortfolioRow) =>
      transformWizardPortfolioRow(r)
    );

    // Enrich initialized portfolios with live P&L
    const initialized = existing.filter((p: any) => p.isInitialized && p.id);
    if (initialized.length > 0) {
      try {
        const ids = initialized.map((p: any) => p.id);
        const { data: allHoldings } = await (supabase.from('wizard_holding') as any)
          .select('portfolio_id, symbol, quantity, total_invested')
          .in('portfolio_id', ids);

        if (allHoldings?.length) {
          const symbols = [...new Set(allHoldings.map((h: any) => h.symbol))] as string[];
          const priceMap = new Map<string, number>();
          await Promise.allSettled(
            symbols.map(async (sym) => {
              try {
                const q = await yf.quote(sym) as any;
                if (q?.regularMarketPrice) priceMap.set(sym, q.regularMarketPrice as number);
              } catch { /* skip */ }
            })
          );

          for (const p of initialized) {
            const holdings = allHoldings.filter((h: any) => h.portfolio_id === (p as any).id);
            let holdingsValue = 0;
            for (const h of holdings) {
              const price = priceMap.get(h.symbol);
              holdingsValue += price ? Number(h.quantity) * price : Number(h.total_invested);
            }
            const total = holdingsValue + (p as any).cashBalance;
            (p as any).totalValue = total;
            (p as any).totalReturnPct =
              ((total - INITIAL_WIZARD_BALANCE) / INITIAL_WIZARD_BALANCE) * 100;
          }
        }
      } catch { /* enrichment errors are non-fatal */ }
    }

    // Build full list (initialized + placeholders for uninitialized)
    const portfolios = WIZARD_STRATEGIES.map((strat) => {
      const found = existing.find((p: any) => p.strategy === strat);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { strategy: _stratKey, ...cfgRest } = WIZARD_CONFIGS[strat];
      if (found) return { ...found, ...cfgRest };
      return {
        id: null,
        userId: user.id,
        strategy: strat,
        isInitialized: false,
        totalValue: INITIAL_WIZARD_BALANCE,
        cashBalance: INITIAL_WIZARD_BALANCE,
        totalReturnPct: 0,
        companiesScreened: null,
        screeningDate: null,
        ...cfgRest,
      };
    });

    return NextResponse.json({ portfolios });
  } catch (err) {
    console.error('Wizard GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { strategy } = body as { strategy: WizardStrategy };

    if (!strategy || !WIZARD_STRATEGIES.includes(strategy)) {
      return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 });
    }

    // Idempotency check
    const { data: existingPortfolio } = await (supabase.from('wizard_portfolio') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('strategy', strategy)
      .maybeSingle();

    if (existingPortfolio) {
      return NextResponse.json(
        { error: 'Portfolio already initialized for this strategy' },
        { status: 409 }
      );
    }

    // Create portfolio record
    const { data: portfolio, error: portfolioError } = await (supabase.from('wizard_portfolio') as any)
      .insert({
        user_id: user.id,
        strategy,
        is_initialized: false,
        total_value: INITIAL_WIZARD_BALANCE,
        cash_balance: INITIAL_WIZARD_BALANCE,
        total_return_pct: 0,
      })
      .select()
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }

    // ── Screen stocks ──────────────────────────────────────────────────────
    const batchSize = 15; // smaller batches — more data per call now
    const rawStocks: ScreenedStock[] = [];

    for (let i = 0; i < WIZARD_STOCK_UNIVERSE.length; i += batchSize) {
      const batch = WIZARD_STOCK_UNIVERSE.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(fetchStockData));
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          rawStocks.push(result.value);
        }
      }
    }

    const filtered = strategy === 'houdini'
      ? applyHoudiniFilters(rawStocks)
      : rawStocks;

    const ranked = rankStocks(filtered);
    // For Houdini, invest in ALL that pass (often < 30 due to elite filters)
    const topN = strategy === 'houdini'
      ? ranked           // invest in every stock that cleared the gate
      : ranked.slice(0, WIZARD_TOP_N);

    const companiesScreened = rawStocks.length;
    const positionCount = Math.max(topN.length, 1);
    const perPositionAmount = INITIAL_WIZARD_BALANCE / positionCount;

    const errors: string[] = [];
    let holdingsCreated = 0;
    let remainingCash = INITIAL_WIZARD_BALANCE;

    for (let rank = 0; rank < topN.length; rank++) {
      const stock = topN[rank];
      try {
        const quantity = perPositionAmount / stock.price;
        const actualInvested = quantity * stock.price;

        const { error: holdingError } = await (supabase.from('wizard_holding') as any).insert({
          portfolio_id: portfolio.id,
          symbol: stock.symbol,
          asset_name: stock.name,
          pe_ratio: stock.peRatio,
          earnings_yield: stock.earningsYield,
          return_on_equity: stock.returnOnEquity,
          magic_rank: rank + 1,
          target_allocation_pct: (1 / positionCount) * 100,
          quantity,
          average_buy_price: stock.price,
          total_invested: actualInvested,
        });

        if (holdingError) {
          errors.push(`Failed to create holding for ${stock.symbol}: ${holdingError.message}`);
          continue;
        }

        holdingsCreated++;

        // Build notes — richer for Houdini
        let notes = `Rank #${rank + 1} | P/E ${stock.peRatio.toFixed(1)} | ROE ${(stock.returnOnEquity * 100).toFixed(1)}%`;
        if (strategy === 'houdini') {
          if (stock.grossMargin != null)
            notes += ` | GM ${(stock.grossMargin * 100).toFixed(0)}%`;
          if (stock.operatingMargin != null)
            notes += ` | OpM ${(stock.operatingMargin * 100).toFixed(0)}%`;
          if (stock.fcfYield != null)
            notes += ` | FCFy ${(stock.fcfYield * 100).toFixed(1)}%`;
          if (stock.piotroskiScore)
            notes += ` | Piotroski ${stock.piotroskiScore}/8`;
          if (stock.altmanZ != null)
            notes += ` | Altman Z ${stock.altmanZ.toFixed(1)}`;
        }

        await (supabase.from('wizard_transaction') as any).insert({
          portfolio_id: portfolio.id,
          symbol: stock.symbol,
          transaction_type: 'buy',
          quantity,
          price_per_unit: stock.price,
          total_amount: actualInvested,
          notes,
        });

        remainingCash -= actualInvested;
      } catch (err) {
        errors.push(`Error processing ${stock.symbol}: ${err}`);
      }
    }

    await (supabase.from('wizard_portfolio') as any)
      .update({
        is_initialized: true,
        cash_balance: Math.max(remainingCash, 0),
        total_value: INITIAL_WIZARD_BALANCE,
        total_return_pct: 0,
        companies_screened: companiesScreened,
        screening_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', portfolio.id);

    return NextResponse.json({
      success: true,
      holdingsCreated,
      companiesScreened,
      houdiniFiltered: strategy === 'houdini' ? filtered.length : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Wizard POST error:', err);
    return NextResponse.json({ error: 'Failed to initialize portfolio' }, { status: 500 });
  }
}
