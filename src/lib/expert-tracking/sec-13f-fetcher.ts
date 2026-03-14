/**
 * SEC EDGAR 13F Quarterly Filing Fetcher
 * Fetches 13F-HR filings from the SEC's public EDGAR API (no key required)
 * and diffs them against config holdings to detect changes.
 *
 * IMPORTANT DATA FRESHNESS NOTE:
 * The SEC mandates a 45-day filing window after each quarter ends.
 * Q1 (Mar 31) → published by ~May 15
 * Q2 (Jun 30) → published by ~Aug 14
 * Q3 (Sep 30) → published by ~Nov 14
 * Q4 (Dec 31) → published by ~Feb 14
 * Holdings shown here may be up to ~135 days old (45-day delay + up to 90 days into next quarter).
 */

import axios from 'axios';
import { EXPERT_INVESTORS } from '@/config/expert-investors';
import type { ActivityEvent } from './ark-fetcher';

const EDGAR_BASE = 'https://data.sec.gov';

// SEC requires a User-Agent header to identify your application
const SEC_HEADERS = {
  'User-Agent': 'investment-tracker-app admin@localhost',
  'Accept-Encoding': 'gzip, deflate',
};

// Minimum portfolio % change to record as an increase/decrease event
// Higher threshold than ARK (2% vs 0.5%) since quarterly filings reflect larger moves
const MIN_CHANGE_PCT = 2.0;

/**
 * Investor slug → SEC CIK (Central Index Key)
 * Verified from https://www.sec.gov/cgi-bin/browse-edgar
 */
export const INVESTOR_CIKS: Partial<Record<string, string>> = {
  buffett:       '0000102909', // Berkshire Hathaway Inc
  druckenmiller: '0001536411', // Duquesne Family Office LLC
  asness:        '0001327895', // AQR Capital Management LLC
  burry:         '0001649339', // Scion Asset Management LLC
  pabrai:        '0001173334', // Pabrai Investment Funds
  marks:         '0001411579', // Oaktree Capital Management LP
  greenblatt:    '0001326828', // Gotham Asset Management LLC
  dalio:         '0001350694', // Bridgewater Associates LP
  smith:         '0001569205', // Fundsmith LLP
  hempton:       '0001471085', // Bronte Capital Management Pty Ltd
};

interface Holding13F {
  nameOfIssuer: string;
  cusip: string;
  value: number; // in thousands USD
  shares: number;
}

/** Extract text content of a single XML tag (first match, case-insensitive) */
function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

/** Parse the informationTable XML from a 13F-HR filing */
function parse13FXML(xml: string): Holding13F[] {
  const holdings: Holding13F[] = [];
  const rowRe = /<infoTable>([\s\S]*?)<\/infoTable>/gi;
  let m;
  while ((m = rowRe.exec(xml)) !== null) {
    const block = m[1];
    const nameOfIssuer = xmlTag(block, 'nameOfIssuer');
    const cusip        = xmlTag(block, 'cusip');
    const value        = parseFloat(xmlTag(block, 'value').replace(/,/g, '')) || 0;
    const shares       = parseFloat(xmlTag(block, 'sshPrnamt').replace(/,/g, '')) || 0;
    if (nameOfIssuer && value > 0) {
      holdings.push({ nameOfIssuer, cusip, value, shares });
    }
  }
  return holdings;
}

/**
 * Normalize a company name for fuzzy matching:
 * "APPLE INC" → "APPLE", "MICROSOFT CORP" → "MICROSOFT"
 */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\b(INC|CORP|CORPORATION|CO|LLC|LTD|PLC|LP|NV|SA|AG|SE|ETF|TRUST|FUND|FUND[S]|GROUP|HOLDING|HOLDINGS|INTL|INTERNATIONAL|INDUSTRIES|ENTERPRISES|COMPANY|TECHNOLOGIES|TECHNOLOGY|PHARMACEUTICALS|PHARMACEUTICAL|BANCORP|FINANCIAL|CAPITAL)\b\.?/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a 13F company name to a ticker symbol from the config holdings.
 * Falls back to an abbreviated version of the company name.
 */
function findTicker(
  nameOfIssuer: string,
  configHoldings: Array<{ symbol: string; name: string }>,
): string {
  const norm = normalizeName(nameOfIssuer);
  for (const h of configHoldings) {
    const configNorm = normalizeName(h.name);
    if (
      norm === configNorm ||
      norm.startsWith(configNorm) ||
      configNorm.startsWith(norm) ||
      (norm.length > 3 && configNorm.includes(norm)) ||
      (configNorm.length > 3 && norm.includes(configNorm))
    ) {
      return h.symbol;
    }
  }
  // Fallback: first uppercase word of the company name
  const words = norm.split(' ').filter(w => w.length > 1);
  return (words[0] || nameOfIssuer.slice(0, 5)).toUpperCase();
}

/** Fetch and parse the latest 13F-HR filing for one investor */
async function fetchInvestor13F(
  investorSlug: string,
  cik: string,
): Promise<ActivityEvent[]> {
  try {
    // 1. Fetch submission history
    const paddedCik = cik.replace(/^0+/, '').padStart(10, '0');
    const subUrl = `${EDGAR_BASE}/submissions/CIK${paddedCik}.json`;
    const subResp = await axios.get(subUrl, { headers: SEC_HEADERS, timeout: 15000 });
    const recent = subResp.data?.filings?.recent;
    if (!recent?.form) return [];

    // 2. Find the most recent 13F-HR
    const forms: string[]      = recent.form;
    const accessions: string[] = recent.accessionNumber;
    const filingDates: string[]= recent.filingDate;
    const primaryDocs: string[]= recent.primaryDocument;

    const idx = forms.findIndex(f => f === '13F-HR');
    if (idx === -1) {
      console.warn(`[13F Fetcher] No 13F-HR for ${investorSlug}`);
      return [];
    }

    const accession      = accessions[idx];
    const filingDate     = filingDates[idx];
    const primaryDoc     = primaryDocs[idx];
    const accNoDashes    = accession.replace(/-/g, '');
    const cikNum         = parseInt(cik, 10);

    // 3. Fetch the primary document
    const docUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikNum}/${accNoDashes}/${primaryDoc}`;
    const docResp = await axios.get(docUrl, { headers: SEC_HEADERS, timeout: 20000, responseType: 'text' });
    let xml: string = docResp.data;

    // If primary doc is just the cover page (no holdings), try infotable.xml
    if (!xml.toLowerCase().includes('<infotable>')) {
      try {
        const infoUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikNum}/${accNoDashes}/infotable.xml`;
        const infoResp = await axios.get(infoUrl, { headers: SEC_HEADERS, timeout: 20000, responseType: 'text' });
        xml = infoResp.data;
      } catch {
        console.warn(`[13F Fetcher] Holdings XML not found for ${investorSlug}`);
        return [];
      }
    }

    // 4. Parse holdings and compute portfolio weights
    const holdings = parse13FXML(xml);
    if (holdings.length === 0) return [];

    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    if (totalValue === 0) return [];

    const configHoldings = EXPERT_INVESTORS[investorSlug as keyof typeof EXPERT_INVESTORS]?.holdings || [];
    const configMap = new Map<string, number>(configHoldings.map(h => [h.symbol.toUpperCase(), h.allocationPct]));

    // Build new holdings map (symbol → best pct for duplicate tickers)
    const newMap = new Map<string, { pct: number; name: string }>();
    for (const h of holdings) {
      const symbol = findTicker(h.nameOfIssuer, configHoldings);
      const pct = (h.value / totalValue) * 100;
      const existing = newMap.get(symbol);
      if (!existing || pct > existing.pct) {
        newMap.set(symbol, { pct, name: h.nameOfIssuer });
      }
    }

    // 5. Diff new vs config
    const events: ActivityEvent[] = [];

    for (const [symbol, { pct, name }] of newMap) {
      const prevPct = configMap.get(symbol) ?? null;
      if (prevPct === null) {
        events.push({
          investorSlug, eventDate: filingDate, symbol, assetName: name,
          action: 'new_position', amountRange: null, sharesChange: null,
          previousPct: null, newPct: +pct.toFixed(2), source: 'sec_13f',
          rawData: { filingDate, cik, accession },
        });
      } else {
        const diff = pct - prevPct;
        if (Math.abs(diff) >= MIN_CHANGE_PCT) {
          events.push({
            investorSlug, eventDate: filingDate, symbol, assetName: name,
            action: diff > 0 ? 'increase' : 'decrease', amountRange: null, sharesChange: null,
            previousPct: +prevPct.toFixed(2), newPct: +pct.toFixed(2), source: 'sec_13f',
            rawData: { filingDate, cik, accession },
          });
        }
      }
    }

    for (const [symbol, prevPct] of configMap) {
      if (!newMap.has(symbol)) {
        events.push({
          investorSlug, eventDate: filingDate, symbol, assetName: symbol,
          action: 'closed_position', amountRange: null, sharesChange: null,
          previousPct: +prevPct.toFixed(2), newPct: null, source: 'sec_13f',
          rawData: { filingDate, cik, accession },
        });
      }
    }

    console.log(`[13F Fetcher] ${investorSlug}: ${events.length} events (filing ${filingDate})`);
    return events;
  } catch (err: any) {
    console.error(`[13F Fetcher] Error for ${investorSlug}:`, err.message);
    return [];
  }
}

/** Fetch 13F activity for all SEC-tracked investors in parallel */
export async function fetchAll13FActivity(): Promise<ActivityEvent[]> {
  const entries = Object.entries(INVESTOR_CIKS) as [string, string][];
  const results = await Promise.allSettled(
    entries.map(([slug, cik]) => fetchInvestor13F(slug, cik)),
  );
  const allEvents: ActivityEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allEvents.push(...r.value);
  }
  console.log(`[13F Fetcher] Total: ${allEvents.length} events across ${entries.length} investors`);
  return allEvents;
}
