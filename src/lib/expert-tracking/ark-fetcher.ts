/**
 * ARK Invest Holdings Fetcher
 *
 * Fetches the daily ARKK (ARK Innovation ETF) CSV and diffs it against the
 * previously stored state in the database. Falls back to the static config
 * top-10 when no DB state exists yet (first run).
 *
 * URL fallback chain: ARK has changed their CSV URL several times; we try
 * three known patterns before giving up.
 *
 * BASELINE NOTE:
 *   On the very first cron run, the diff is against the static config top-10.
 *   This means all ARKK positions outside the top-10 get flagged as "new_position".
 *   The upsert's `ignoreDuplicates: true` ensures these are only inserted once.
 *   From the second run onward, the DB contains the previous day's state, so
 *   only genuine daily changes are detected.
 */

import axios from 'axios';
import { EXPERT_INVESTORS } from '@/config/expert-investors';

export interface ActivityEvent {
  investorSlug: string;
  eventDate: string; // YYYY-MM-DD
  symbol: string;
  assetName: string;
  action: 'buy' | 'sell' | 'increase' | 'decrease' | 'new_position' | 'closed_position';
  amountRange: string | null;
  sharesChange: number | null;
  previousPct: number | null;
  newPct: number | null;
  source: 'ark_csv' | 'house_disclosure' | 'sec_13f';
  rawData: object;
}

// Known ARK ARKK CSV URL patterns (newest first)
const ARK_CSV_URLS = [
  'https://ark-funds.com/wp-content/uploads/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv',
  'https://ark-funds.com/wp-content/uploads/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv.gz',
  'https://arkfunds.io/api/v2/etf/holdings?symbol=ARKK', // JSON fallback via arkfunds.io
];

// Minimum weight change (in percentage points) to report
const MIN_CHANGE_THRESHOLD = 0.5;

interface ArkHolding {
  date: string;
  company: string;
  ticker: string;
  shares: number;
  marketValue: number;
  weight: number; // percent
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseArkCsv(csv: string): ArkHolding[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const holdings: ArkHolding[] = [];
  // Detect header row — find which line has "ticker" or "weight"
  let startIdx = 1;
  if (lines[0].toLowerCase().includes('ticker') || lines[0].toLowerCase().includes('weight')) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 6) continue;

    // ARK CSV format: date, fund, company, ticker, cusip, shares, marketValue, weight
    const ticker = cols[3];
    if (!ticker || ticker === '-' || ticker === '' || ticker.toLowerCase() === 'ticker') continue;

    const weight     = parseFloat(cols[7]?.replace('%', '') || cols[5]?.replace('%', '') || '0');
    const shares     = parseFloat(cols[5]?.replace(/,/g, '') || '0');
    const marketValue = parseFloat(cols[6]?.replace(/[$,]/g, '') || '0');

    if (isNaN(weight) || weight === 0) continue;

    // Normalize date from "MM/DD/YYYY" or "YYYY-MM-DD"
    let date = cols[0] || new Date().toISOString().split('T')[0];
    const mdyMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) date = `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;

    holdings.push({
      date,
      company: cols[2] || ticker,
      ticker: ticker.toUpperCase().replace(/[^A-Z.]/g, ''),
      shares,
      marketValue,
      weight,
    });
  }

  return holdings;
}

/** Parse arkfunds.io JSON fallback response */
function parseArkFundsJson(data: any): ArkHolding[] {
  const holdings = data?.holdings || data?.data?.holdings || [];
  const today = new Date().toISOString().split('T')[0];

  return holdings
    .filter((h: any) => h.ticker && h.weight)
    .map((h: any) => ({
      date: h.date || today,
      company: h.company || h.ticker,
      ticker: (h.ticker || '').toUpperCase(),
      shares: Number(h.shares) || 0,
      marketValue: Number(h.market_value) || 0,
      weight: Number(h.weight) || 0,
    }));
}

// ── CSV fetcher with URL fallback chain ───────────────────────────────────────

async function fetchArkHoldings(): Promise<ArkHolding[]> {
  for (const url of ARK_CSV_URLS) {
    try {
      const resp = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)' },
        responseType: 'text',
      });

      const body: string = resp.data;

      // If it looks like JSON (arkfunds.io fallback), parse accordingly
      if (url.includes('arkfunds.io') || body.trim().startsWith('{')) {
        try {
          const parsed = parseArkFundsJson(JSON.parse(body));
          if (parsed.length > 0) {
            console.log(`[ARK Fetcher] Got ${parsed.length} holdings from ${url} (JSON)`);
            return parsed;
          }
        } catch { /* not JSON, try CSV */ }
      }

      const holdings = parseArkCsv(body);
      if (holdings.length > 0) {
        console.log(`[ARK Fetcher] Got ${holdings.length} holdings from ${url}`);
        return holdings;
      }
    } catch (err: any) {
      console.warn(`[ARK Fetcher] URL failed (${url}):`, err.message);
    }
  }
  return [];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchARKActivity(
  previousWeights?: Map<string, number>,
): Promise<ActivityEvent[]> {
  const liveHoldings = await fetchArkHoldings();

  if (liveHoldings.length === 0) {
    console.log('[ARK Fetcher] No holdings parsed from any URL');
    return [];
  }

  const today = liveHoldings[0]?.date || new Date().toISOString().split('T')[0];

  // Build baseline: use previousWeights from DB if provided, else static config top-10
  const baselineMap = new Map<string, number>();
  if (previousWeights && previousWeights.size > 0) {
    for (const [sym, w] of previousWeights) baselineMap.set(sym, w);
  } else {
    // First run — use config as rough baseline
    for (const h of EXPERT_INVESTORS.wood.holdings) {
      baselineMap.set(h.symbol.toUpperCase(), h.allocationPct);
    }
  }

  // Build live map
  const liveMap = new Map<string, ArkHolding>();
  for (const h of liveHoldings) {
    liveMap.set(h.ticker, h);
  }

  const events: ActivityEvent[] = [];

  // Detect new positions & weight changes
  for (const [symbol, live] of liveMap) {
    const prevPct = baselineMap.get(symbol) ?? null;

    if (prevPct === null) {
      events.push({
        investorSlug: 'wood',
        eventDate: today,
        symbol,
        assetName: live.company,
        action: 'new_position',
        amountRange: live.marketValue > 0 ? `$${(live.marketValue / 1e6).toFixed(1)}M` : null,
        sharesChange: live.shares || null,
        previousPct: null,
        newPct: live.weight,
        source: 'ark_csv',
        rawData: live,
      });
    } else {
      const diff = live.weight - prevPct;
      if (Math.abs(diff) >= MIN_CHANGE_THRESHOLD) {
        events.push({
          investorSlug: 'wood',
          eventDate: today,
          symbol,
          assetName: live.company,
          action: diff > 0 ? 'increase' : 'decrease',
          amountRange: null,
          sharesChange: null,
          previousPct: prevPct,
          newPct: live.weight,
          source: 'ark_csv',
          rawData: live,
        });
      }
    }
  }

  // Detect closed positions
  for (const [symbol, prevPct] of baselineMap) {
    if (!liveMap.has(symbol)) {
      events.push({
        investorSlug: 'wood',
        eventDate: today,
        symbol,
        assetName: symbol,
        action: 'closed_position',
        amountRange: null,
        sharesChange: null,
        previousPct: prevPct,
        newPct: null,
        source: 'ark_csv',
        rawData: { ticker: symbol, closedFrom: prevPct },
      });
    }
  }

  console.log(`[ARK Fetcher] Detected ${events.length} events for ${today}`);
  return events;
}
