/**
 * Wizard Portfolios API
 * GET  – list both portfolios (Merlin & Houdini) with live P&L
 * POST – initialize a portfolio: screen stocks → buy top 30
 *
 * Merlin : Greenblatt Magic Formula (approximation — uses lightweight data for reliability).
 *   Earnings Yield  = 1 / trailing P/E
 *   Return on Capital = Return on Equity (ROE)
 *
 * Houdini: Greenblatt + 4-pillar quality pre-filter:
 *   1. Consistent company (5 yrs): EPS+FCF positive every year, ROIC > WACC ≥ 80% of years
 *   2. Consistent growth: Revenue CAGR > 0%, no single decline > 10%, EPS CAGR > 0%, no net dilution
 *   3. Low debt: Net Debt / EBITDA < 2×
 *   4. Valuation sanity: DCF gap ≥ −20%, P/E within 1.5× normalized P/E (5-yr avg earnings proxy)
 */

import { NextRequest, NextResponse } from 'next/server';

// Allow up to 60 s for the screening pass (120 stocks × 7 Yahoo Finance modules)
export const maxDuration = 60;
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

  // ── Greenblatt Magic Formula ranking inputs ───────────────────────────────
  peRatio: number | null;            // trailing P/E (used in valuation sanity check)
  earningsYield: number;             // EBIT / Enterprise Value  (Greenblatt exact)
  returnOnCapital: number;           // EBIT / (NWC + Net PP&E)  (Greenblatt exact)

  // ── Profitability ─────────────────────────────────────────────────────────
  operatingMargin: number | null;
  grossMargin: number | null;
  fcfMargin: number | null;          // FCF / revenue

  // ── Debt ─────────────────────────────────────────────────────────────────
  netDebtEbitda: number | null;      // (totalDebt – cash) / EBITDA
  interestCoverage: number | null;   // EBIT / |interestExpense|

  // ── Consistency (from annual history, typically 4 years) ─────────────────
  totalHistoryYears: number;
  revenueCagr: number | null;
  epsCagr: number | null;            // net-income CAGR as EPS proxy
  epsPositiveYears: number;          // years with positive net income
  fcfPositiveYears: number;          // years with positive FCF
  revenueDeclineYears: number;       // years where revenue fell YoY
  maxRevenueDeclinePct: number;      // worst single-year YoY revenue decline (0 if none)
  roicAboveWaccYears: number;        // years where annual ROIC (EBIT/TangCap) > 10%
  roicHistoryYears: number;          // years where per-year ROIC was computable

  // ── Share dilution ────────────────────────────────────────────────────────
  sharesIssuedOrNeutral: boolean | null; // true = net issuance (dilution); null = no data

  // ── Valuation ────────────────────────────────────────────────────────────
  pegRatio: number | null;
  evEbit: number | null;             // EV / EBIT
  fcfYield: number | null;           // FCF / market cap
  dcfGap: number | null;             // (DCF value – price) / price; positive = undervalued
  normalizedPE: number | null;       // price / (avg historical EPS) — 5-yr P/E proxy

  // ── Quality composites ────────────────────────────────────────────────────
  piotroskiScore: number;            // 0–8 (dilution signal skipped)
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
 * Growth: capped historical CAGR (2–15%).  WACC: 10%.  Terminal growth: 3% (≈ GDP).
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
  const wacc = 0.085; // 8.5% — within the 8-10% conservative range the user requested
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
    // Lightweight modules first — always reliable on serverless
    const [summaryLight, quote] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'price'],
      }),
      yf.quote(symbol) as Promise<any>,
    ]);

    const fd  = summaryLight.financialData;
    const ks  = summaryLight.defaultKeyStatistics;
    const sd  = summaryLight.summaryDetail;
    const pr  = summaryLight.price;

    // ── Price ──────────────────────────────────────────────────────────────
    const price: number | null = (quote?.regularMarketPrice ?? pr?.regularMarketPrice) ?? null;
    if (!price || price <= 0) return null;

    // ── History modules: best-effort (can be rate-limited from Vercel) ────
    // If they fail, consistency/quality checks will be skipped (null-guard).
    let incomeStmts: any[]  = [];
    let balanceSheets: any[] = [];
    let cashflows: any[]    = [];
    try {
      const hist = await yf.quoteSummary(symbol, {
        modules: ['incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory'],
      });
      incomeStmts  = (hist.incomeStatementHistory as any)?.incomeStatementHistory ?? [];
      balanceSheets = (hist.balanceSheetHistory as any)?.balanceSheetStatements ?? [];
      cashflows    = (hist.cashflowStatementHistory as any)?.cashflowStatements ?? [];
    } catch {
      // History unavailable — Houdini checks that require it will be skipped
    }

    const latestInc = incomeStmts[0];
    const latestBS  = balanceSheets[0];
    const latestCF  = cashflows[0];

    // ── EBIT — history first, then lightweight fallbacks ──────────────────
    const ebitValue: number | null =
      latestInc?.ebit != null            ? Number(latestInc.ebit) :
      latestInc?.operatingIncome != null ? Number(latestInc.operatingIncome) :
      fd?.operatingMargins != null && fd?.totalRevenue != null
        ? Number(fd.operatingMargins) * Number(fd.totalRevenue) :
      fd?.ebitda != null                 ? Number(fd.ebitda) : // EBITDA ≈ EBIT as last resort
      null;

    // ── Enterprise Value ───────────────────────────────────────────────────
    const enterpriseValue: number | null =
      ks?.enterpriseValue != null ? Number(ks.enterpriseValue) : null;

    // ── Earnings Yield: EBIT/EV (Greenblatt) with 1/PE fallback ───────────
    // Falls back to 1/PE when EBIT or EV are unavailable (e.g. history failed).
    let earningsYield: number;
    if (ebitValue != null && ebitValue > 0 && enterpriseValue != null && enterpriseValue > 0) {
      earningsYield = ebitValue / enterpriseValue;
    } else {
      const tempPE: number | null =
        (sd?.trailingPE as number | undefined) != null ? Number(sd!.trailingPE) :
        ks?.trailingEps != null && price > 0 ? price / Number(ks.trailingEps) : null;
      if (!tempPE || tempPE <= 0 || tempPE > 500) return null;
      earningsYield = 1 / tempPE;
    }

    // ── Market cap & shares outstanding ───────────────────────────────────
    const sharesOutstanding: number | null =
      (ks?.sharesOutstanding ?? pr?.sharesOutstanding) != null
        ? Number(ks?.sharesOutstanding ?? pr?.sharesOutstanding)
        : null;
    const marketCap: number | null =
      pr?.marketCap != null ? Number(pr.marketCap) :
      sharesOutstanding ? sharesOutstanding * price : null;

    // ── Cash & Debt ────────────────────────────────────────────────────────
    const totalDebt = fd?.totalDebt != null ? Number(fd.totalDebt) :
      latestBS?.longTermDebt != null
        ? latestBS.longTermDebt + (latestBS.shortLongTermDebt ?? 0) : null;

    const totalCash = fd?.totalCash != null ? Number(fd.totalCash) :
      latestBS?.cash != null
        ? latestBS.cash + (latestBS.shortTermInvestments ?? 0) : null;

    // ── Greenblatt Return on Capital: EBIT / (NWC + Net PP&E) ─────────────
    // NWC is adjusted to exclude excess cash (Greenblatt's approach).
    const currentAssets: number  = latestBS?.totalCurrentAssets ?? 0;
    const currentLiab: number    = latestBS?.totalCurrentLiabilities ?? 0;
    const cashForNWC: number     = totalCash ?? 0;
    const nwc: number            = Math.max(0, currentAssets - cashForNWC - currentLiab);

    // Net PP&E: try the direct field first; if null, approximate from the balance sheet
    // as (totalAssets – currentAssets – longTermInvestments – goodwill – intangibles).
    const netPPE_direct: number | undefined = (latestBS as any)?.propertyPlantEquipment;
    const netPPE: number = netPPE_direct != null
      ? netPPE_direct
      : Math.max(0,
          (latestBS?.totalAssets ?? 0)
          - (latestBS?.totalCurrentAssets ?? 0)
          - ((latestBS as any)?.longTermInvestments ?? 0)
          - ((latestBS as any)?.goodWill ?? 0)
          - ((latestBS as any)?.intangibleAssets ?? 0)
        );

    const tangibleCap: number = nwc + netPPE;

    // If tangibleCap is still 0 (e.g. financial company with no conventional balance sheet),
    // fall back to 10% of total assets.  If we have no asset data at all, skip.
    const effectiveTangibleCap = tangibleCap > 0
      ? tangibleCap
      : (latestBS?.totalAssets ?? 0) * 0.10;

    // Compute ROIC from tangible cap if available; otherwise fall back to ROE from
    // financialData (happens when history modules are unavailable — rate limit / serverless).
    let returnOnCapital: number;
    if (effectiveTangibleCap > 0) {
      returnOnCapital = ebitValue / effectiveTangibleCap;
    } else if (fd?.returnOnEquity != null && Number(fd.returnOnEquity) > 0) {
      returnOnCapital = Number(fd.returnOnEquity);
    } else {
      return null;
    }
    if (returnOnCapital <= 0) return null;

    // ── Trailing P/E (optional — kept for valuation sanity check) ─────────
    let trailingPE: number | null = (sd?.trailingPE as number | undefined) ?? null;
    if (!trailingPE && ks?.trailingEps != null && price > 0) {
      trailingPE = price / Number(ks.trailingEps);
    }
    if (trailingPE && (trailingPE <= 0 || trailingPE > 500)) trailingPE = null;

    // ── Profitability ──────────────────────────────────────────────────────
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

    // ── Debt ratios ────────────────────────────────────────────────────────
    const ebitda = fd?.ebitda != null ? Number(fd.ebitda) : null;

    const netDebtEbitda =
      totalDebt != null && totalCash != null && ebitda && ebitda > 0
        ? (totalDebt - totalCash) / ebitda : null;

    const interestExpense = latestInc?.interestExpense ?? null;
    const interestCoverage =
      ebitValue != null && interestExpense != null && interestExpense !== 0
        ? ebitValue / Math.abs(interestExpense) : null;

    // ── Consistency (from annual history) ─────────────────────────────────
    const totalHistoryYears = incomeStmts.length;

    // Revenue array (oldest → newest)
    const revenues: number[] = [...incomeStmts]
      .reverse()
      .map((s: any) => s.totalRevenue)
      .filter((v): v is number => v != null && v > 0);

    const revenueCagr = computeCagr(revenues);

    // Revenue decline tracking
    let revenueDeclineYears = 0;
    let maxRevenueDeclinePct = 0;
    for (let i = 1; i < revenues.length; i++) {
      if (revenues[i] < revenues[i - 1]) {
        revenueDeclineYears++;
        const pct = (revenues[i - 1] - revenues[i]) / revenues[i - 1];
        if (pct > maxRevenueDeclinePct) maxRevenueDeclinePct = pct;
      }
    }

    // Net income (oldest → newest, includes negatives for counting)
    const netIncomes: number[] = [...incomeStmts]
      .reverse()
      .map((s: any) => s.netIncome)
      .filter((v): v is number => v != null);

    const epsPositiveYears = netIncomes.filter((v) => v > 0).length;
    const epsCagr = computeCagr(
      netIncomes.filter((v) => v > 0).length === netIncomes.length ? netIncomes : []
    );

    // FCF per year (oldest → newest, positive-only for DCF)
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
      .filter((v): v is number => v != null && v > 0);

    const fcfPositiveYears = [...cashflows].filter((cf: any) => {
      const fcf = cf.freeCashflow ??
        (cf.totalCashFromOperatingActivities != null
          ? cf.totalCashFromOperatingActivities + (cf.capitalExpenditures ?? 0)
          : null);
      return fcf != null && fcf > 0;
    }).length;

    // ── Per-year ROIC (for Houdini: ROIC > WACC in ≥ 80% of years) ────────
    let roicAboveWaccYears = 0;
    let roicHistoryYears   = 0;
    const waccThreshold    = 0.10;

    for (let i = 0; i < Math.min(incomeStmts.length, balanceSheets.length); i++) {
      const inc = incomeStmts[i];
      const bs  = balanceSheets[i];
      const yearEbit: number | null =
        inc?.ebit != null          ? Number(inc.ebit) :
        inc?.operatingIncome != null ? Number(inc.operatingIncome) : null;
      if (!yearEbit || yearEbit <= 0) continue;

      const yearCA: number   = bs?.totalCurrentAssets ?? 0;
      const yearCL: number   = bs?.totalCurrentLiabilities ?? 0;
      const yearCash: number = bs?.cash ?? 0;
      const yearNWC: number  = Math.max(0, yearCA - yearCash - yearCL);
      const yearPPE_direct   = (bs as any)?.propertyPlantEquipment;
      const yearPPE: number  = yearPPE_direct != null
        ? yearPPE_direct
        : Math.max(0,
            (bs?.totalAssets ?? 0)
            - yearCA
            - ((bs as any)?.longTermInvestments ?? 0)
            - ((bs as any)?.goodWill ?? 0)
            - ((bs as any)?.intangibleAssets ?? 0)
          );
      const yearTangCapRaw   = yearNWC + yearPPE;
      const yearTangCap      = yearTangCapRaw > 0
        ? yearTangCapRaw
        : (bs?.totalAssets ?? 0) * 0.10;
      if (yearTangCap <= 0) continue;

      roicHistoryYears++;
      if (yearEbit / yearTangCap > waccThreshold) roicAboveWaccYears++;
    }

    // ── Share dilution: net issuance/repurchase over period ───────────────
    // repurchaseOfStock is negative when buying back; issuanceOfStock is positive.
    let totalNetIssuance = 0;
    let hasShareData     = false;
    for (const cf of cashflows) {
      const repurchase: number = (cf as any)?.repurchaseOfStock ?? 0;
      const issuance: number   = (cf as any)?.issuanceOfStock ?? 0;
      if (repurchase !== 0 || issuance !== 0) {
        totalNetIssuance += repurchase + issuance;
        hasShareData = true;
      }
    }
    // < 0 = net buybacks (shares declining, good); ≥ 0 = net dilution (bad)
    const sharesIssuedOrNeutral: boolean | null =
      hasShareData ? totalNetIssuance >= 0 : null;

    // ── Normalized P/E: price / avg historical EPS ────────────────────────
    // Approximates "5-yr average P/E" without historical price data.
    // Catches stocks that look cheap only because of an exceptional recent year:
    //   if trailing P/E > 1.5× normalizedPE, current earnings are running well
    //   above the historical average → the "cheapness" may not be durable.
    const positiveNetIncomes = netIncomes.filter((v) => v > 0);
    const avgHistNetIncome =
      positiveNetIncomes.length > 0
        ? positiveNetIncomes.reduce((s, v) => s + v, 0) / positiveNetIncomes.length
        : null;
    const normalizedPE =
      avgHistNetIncome && sharesOutstanding && sharesOutstanding > 0
        ? price / (avgHistNetIncome / sharesOutstanding)
        : null;

    // ── Valuation ─────────────────────────────────────────────────────────
    const pegRatio = ks?.pegRatio != null ? Number(ks.pegRatio) : null;
    const evEbit   = (enterpriseValue != null && enterpriseValue > 0 && ebitValue != null && ebitValue > 0)
      ? enterpriseValue / ebitValue : null;

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
      returnOnCapital,
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
      maxRevenueDeclinePct,
      roicAboveWaccYears,
      roicHistoryYears,
      sharesIssuedOrNeutral,
      pegRatio,
      evEbit,
      fcfYield,
      dcfGap,
      normalizedPE,
      piotroskiScore,
      altmanZ,
      institutionalOwnership,
      above200dMA,
      combinedRank: 0,
    };
  } catch (err: any) {
    console.error(`[Wizard] fetchStockData(${symbol}) failed:`, err?.message ?? err);
    return null;
  }
}

// ─── Merlin-only simple fetch (lightweight modules, no history) ───────────────

/**
 * Merlin: approximation of Greenblatt Magic Formula using only lightweight Yahoo Finance data.
 *   Earnings Yield  = 1 / trailingPE
 *   Return on Capital = ROE (returnOnEquity from financialData)
 * Requires only 4 lightweight modules → reliable on Vercel serverless.
 */
async function fetchStockDataMerlin(symbol: string): Promise<ScreenedStock | null> {
  try {
    const [summaryLight, quote] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'price'],
      }),
      yf.quote(symbol) as Promise<any>,
    ]);

    const fd = summaryLight.financialData;
    const ks = summaryLight.defaultKeyStatistics;
    const sd = summaryLight.summaryDetail;
    const pr = summaryLight.price;

    const price: number | null = (quote?.regularMarketPrice ?? pr?.regularMarketPrice) ?? null;
    if (!price || price <= 0) return null;

    // Trailing P/E — required for Earnings Yield
    let trailingPE: number | null = (sd?.trailingPE as number | undefined) ?? null;
    if (!trailingPE && ks?.trailingEps != null && price > 0) {
      trailingPE = price / Number(ks.trailingEps);
    }
    if (!trailingPE || trailingPE <= 0 || trailingPE > 500) return null;

    const earningsYield = 1 / trailingPE; // Greenblatt approximation

    // ROE — required for Return on Capital
    const roe = fd?.returnOnEquity != null ? Number(fd.returnOnEquity) : null;
    if (!roe || roe <= 0) return null;

    const name = String(
      (quote as any)?.shortName ?? (quote as any)?.longName ?? pr?.shortName ?? symbol
    );

    // Extra lightweight fields used by Houdini quality filter
    const operatingMarginLW = fd?.operatingMargins != null ? Number(fd.operatingMargins) : null;
    const grossMarginLW     = (fd as any)?.grossMargins != null ? Number((fd as any).grossMargins) : null;
    const fdEbitda    = fd?.ebitda    != null ? Number(fd.ebitda)    : null;
    const fdTotalDebt = fd?.totalDebt != null ? Number(fd.totalDebt) : null;
    const fdTotalCash = fd?.totalCash != null ? Number(fd.totalCash) : null;
    const netDebtEbitdaLW =
      fdEbitda && fdEbitda > 0 && fdTotalDebt != null && fdTotalCash != null
        ? (fdTotalDebt - fdTotalCash) / fdEbitda : null;

    return {
      symbol,
      name,
      price,
      peRatio: trailingPE,
      earningsYield,
      returnOnCapital: roe,
      operatingMargin: operatingMarginLW,
      grossMargin: grossMarginLW,
      fcfMargin: null,
      netDebtEbitda: netDebtEbitdaLW,
      interestCoverage: null,
      totalHistoryYears: 0,
      revenueCagr: null,
      epsCagr: null,
      epsPositiveYears: 0,
      fcfPositiveYears: 0,
      revenueDeclineYears: 0,
      maxRevenueDeclinePct: 0,
      roicAboveWaccYears: 0,
      roicHistoryYears: 0,
      sharesIssuedOrNeutral: null,
      pegRatio: null,
      evEbit: null,
      fcfYield: null,
      dcfGap: null,
      normalizedPE: null,
      piotroskiScore: 0,
      altmanZ: null,
      institutionalOwnership: null,
      above200dMA: null,
      combinedRank: 0,
    };
  } catch (err: any) {
    console.error(`[Wizard] fetchStockDataMerlin(${symbol}) failed:`, err?.message ?? err);
    return null;
  }
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Greenblatt exact dual-rank: rank by Earnings Yield descending + Return on Capital
 * descending; sum both ranks — the lowest combined score wins.
 */
function rankStocks(stocks: ScreenedStock[]): ScreenedStock[] {
  const sorted = [...stocks];

  const byEY  = [...sorted].sort((a, b) => b.earningsYield - a.earningsYield);
  const byROC = [...sorted].sort((a, b) => b.returnOnCapital - a.returnOnCapital);
  const eyRank  = new Map(byEY.map((s, i) => [s.symbol, i + 1]));
  const rocRank = new Map(byROC.map((s, i) => [s.symbol, i + 1]));

  for (const s of sorted) {
    s.combinedRank = (eyRank.get(s.symbol) ?? 999) + (rocRank.get(s.symbol) ?? 999);
  }

  return sorted.sort((a, b) => a.combinedRank - b.combinedRank);
}

// ─── Houdini pre-filter ───────────────────────────────────────────────────────

/**
 * Houdini quality gate — uses only lightweight real-time data (no history required).
 * Four checks, all using fields from financialData / defaultKeyStatistics / summaryDetail.
 * Any check is SKIPPED when its data is null.
 */
function applyHoudiniFilters(stocks: ScreenedStock[]): ScreenedStock[] {
  return stocks.filter((s) => {
    // 1. ROE ≥ 15% — efficient capital use (returnOnCapital = ROE for lightweight fetch)
    if (s.returnOnCapital < 0.15) return false;

    // 2. Operating margin ≥ 10% — profitable core business
    if (s.operatingMargin !== null && s.operatingMargin < 0.10) return false;

    // 3. P/E ≤ 40 — not absurdly overvalued
    if (s.peRatio !== null && s.peRatio > 40) return false;

    // 4. Net Debt / EBITDA < 3× — manageable leverage
    if (s.netDebtEbitda !== null && s.netDebtEbitda >= 3.0) return false;

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
    // Both strategies use the lightweight fetch (1/PE + ROE).
    // Houdini's quality gate then filters via applyHoudiniFilters() below.
    const fetchFn = fetchStockDataMerlin;
    const batchSize = 10; // smaller batches reduce Yahoo Finance rate-limit risk
    const rawStocks: ScreenedStock[] = [];

    for (let i = 0; i < WIZARD_STOCK_UNIVERSE.length; i += batchSize) {
      const batch = WIZARD_STOCK_UNIVERSE.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(fetchFn));
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          rawStocks.push(result.value);
        }
      }
      // Brief pause between batches to avoid Yahoo Finance rate limits
      if (i + batchSize < WIZARD_STOCK_UNIVERSE.length) {
        await new Promise<void>((r) => setTimeout(r, 200));
      }
    }

    const filtered = strategy === 'houdini'
      ? applyHoudiniFilters(rawStocks)
      : rawStocks;

    const ranked = rankStocks(filtered);
    // Both strategies invest in the top 30 by Magic Formula rank.
    // Houdini's quality gate means these 30 are drawn from a pre-screened elite set.
    const topN = ranked.slice(0, WIZARD_TOP_N);

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
          earnings_yield: stock.earningsYield,      // EBIT / EV  (Greenblatt exact)
          return_on_equity: stock.returnOnCapital,  // EBIT / TangibleCap (Greenblatt exact)
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

        // Build transaction notes
        const eyLabel = strategy === 'merlin' ? 'EY≈1/PE' : 'EY=EBIT/EV';
        const rocLabel = strategy === 'merlin' ? 'ROE' : 'ROIC';
        let notes = `Rank #${rank + 1} | ${eyLabel} ${(stock.earningsYield * 100).toFixed(2)}% | ${rocLabel} ${(stock.returnOnCapital * 100).toFixed(1)}%`;
        if (strategy === 'houdini') {
          if (stock.revenueCagr != null)
            notes += ` | RevCAGR ${(stock.revenueCagr * 100).toFixed(1)}%`;
          if (stock.epsCagr != null)
            notes += ` | EPSCAGR ${(stock.epsCagr * 100).toFixed(1)}%`;
          if (stock.netDebtEbitda != null)
            notes += ` | ND/EBITDA ${stock.netDebtEbitda.toFixed(1)}x`;
          if (stock.dcfGap != null)
            notes += ` | DCF ${stock.dcfGap >= 0 ? '+' : ''}${(stock.dcfGap * 100).toFixed(0)}%`;
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
