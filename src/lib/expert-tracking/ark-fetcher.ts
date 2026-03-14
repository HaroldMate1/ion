/**
 * ARK Invest Holdings Fetcher
 * Fetches daily ARKK CSV and detects changes vs stored config
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

const ARK_CSV_URL = 'https://ark-funds.com/wp-content/uploads/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv';

// Minimum weight change to report (percentage points)
const MIN_CHANGE_THRESHOLD = 0.5;

interface ArkHolding {
  date: string;
  company: string;
  ticker: string;
  shares: number;
  marketValue: number;
  weight: number; // percent
}

function parseArkCsv(csv: string): ArkHolding[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Skip header row
  const holdings: ArkHolding[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle quoted fields — simple split by comma, stripping quotes
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 8) continue;

    const ticker = cols[3]; // ticker column
    if (!ticker || ticker === '-' || ticker === '') continue;

    const weight = parseFloat(cols[7]?.replace('%', '') || '0');
    const shares = parseFloat(cols[5]?.replace(/,/g, '') || '0');
    const marketValue = parseFloat(cols[6]?.replace(/[$,]/g, '') || '0');

    if (isNaN(weight)) continue;

    holdings.push({
      date: cols[0] || new Date().toISOString().split('T')[0],
      company: cols[2] || ticker,
      ticker: ticker.toUpperCase(),
      shares,
      marketValue,
      weight,
    });
  }

  return holdings;
}

export async function fetchARKActivity(): Promise<ActivityEvent[]> {
  try {
    const response = await axios.get(ARK_CSV_URL, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)' },
      responseType: 'text',
    });

    const csv: string = response.data;
    const liveHoldings = parseArkCsv(csv);

    if (liveHoldings.length === 0) {
      console.log('[ARK Fetcher] No holdings parsed from CSV');
      return [];
    }

    const today = liveHoldings[0]?.date || new Date().toISOString().split('T')[0];
    const configHoldings = EXPERT_INVESTORS.wood.holdings;

    // Build map of config holdings: symbol → allocationPct
    const configMap = new Map<string, number>();
    for (const h of configHoldings) {
      configMap.set(h.symbol.toUpperCase(), h.allocationPct);
    }

    // Build map of live holdings: symbol → weight
    const liveMap = new Map<string, ArkHolding>();
    for (const h of liveHoldings) {
      liveMap.set(h.ticker, h);
    }

    const events: ActivityEvent[] = [];

    // Detect new positions & weight increases
    for (const [symbol, live] of liveMap) {
      const prevPct = configMap.get(symbol) ?? null;

      if (prevPct === null) {
        // New position
        events.push({
          investorSlug: 'wood',
          eventDate: today,
          symbol,
          assetName: live.company,
          action: 'new_position',
          amountRange: `$${(live.marketValue / 1e6).toFixed(1)}M`,
          sharesChange: live.shares,
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
    for (const [symbol, prevPct] of configMap) {
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
  } catch (err: any) {
    console.error('[ARK Fetcher] Error:', err.message);
    return [];
  }
}
