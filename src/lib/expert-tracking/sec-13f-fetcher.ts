/**
 * SEC EDGAR 13F Quarterly Filing Fetcher
 *
 * Diffs the TWO most recent 13F-HR filings from SEC EDGAR for each investor
 * to detect real quarter-over-quarter position changes.
 *
 * Why two filings, not static config?
 *   Comparing against a hardcoded top-10 list causes false-positive "new_position"
 *   events for every holding outside that list. Comparing consecutive SEC filings
 *   produces only real changes.
 *
 * Ticker resolution:
 *   SEC 13F XML has no ticker field — only nameOfIssuer and CUSIP. We resolve tickers
 *   by (1) fuzzy-matching company names against the investor's config holdings,
 *   (2) trying a CUSIP→ticker lookup via the SEC company tickers file, then
 *   (3) falling back to a normalized first-word abbreviation.
 *
 * DATA FRESHNESS:
 *   Q1 (Mar 31) → published by ~May 15
 *   Q2 (Jun 30) → published by ~Aug 14
 *   Q3 (Sep 30) → published by ~Nov 14
 *   Q4 (Dec 31) → published by ~Feb 14
 */

import axios from 'axios';
import { EXPERT_INVESTORS } from '@/config/expert-investors';
import type { ActivityEvent } from './ark-fetcher';

const EDGAR_BASE = 'https://data.sec.gov';

// SEC requires a descriptive User-Agent
const SEC_HEADERS = {
  'User-Agent': 'investment-tracker-app admin@localhost',
  'Accept-Encoding': 'gzip, deflate',
};

// Minimum % change between filings to record as an event
const MIN_CHANGE_PCT = 2.0;
// Minimum % weight for a new position to be worth reporting
const MIN_NEW_POSITION_PCT = 0.5;
// Minimum % weight for a closed position to be worth reporting
const MIN_CLOSED_POSITION_PCT = 1.0;

/**
 * Investor slug → SEC CIK (Central Index Key)
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
  value: number; // thousands USD
  shares: number;
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

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

// ── Ticker resolution ─────────────────────────────────────────────────────────

/**
 * Normalize a company name for fuzzy matching — strips legal suffixes.
 * "MICROSOFT CORP" → "MICROSOFT"
 */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(
      /\b(INC|CORP|CORPORATION|CO|LLC|LTD|PLC|LP|NV|SA|AG|SE|ETF|TRUST|FUND|FUNDS|GROUP|HOLDING|HOLDINGS|INTL|INTERNATIONAL|INDUSTRIES|ENTERPRISES|COMPANY|TECHNOLOGIES|TECHNOLOGY|PHARMACEUTICALS|PHARMACEUTICAL|BANCORP|FINANCIAL|CAPITAL|MANAGEMENT)\b\.?/g,
      '',
    )
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy-match a 13F nameOfIssuer against the investor's config holdings.
 * Returns the ticker symbol if a match is found, null otherwise.
 */
function findTickerInConfig(
  nameOfIssuer: string,
  configHoldings: Array<{ symbol: string; name: string }>,
): string | null {
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
  return null;
}

/**
 * Resolve the best display ticker for a 13F holding.
 * Priority: (1) match against config, (2) uppercase first word of company name
 */
function resolveTicker(
  nameOfIssuer: string,
  configHoldings: Array<{ symbol: string; name: string }>,
): string {
  const fromConfig = findTickerInConfig(nameOfIssuer, configHoldings);
  if (fromConfig) return fromConfig;

  // Fallback: first meaningful word of the normalized name, max 5 chars
  const norm = normalizeName(nameOfIssuer);
  const words = norm.split(' ').filter(w => w.length > 1);
  return (words[0] || nameOfIssuer.slice(0, 5)).slice(0, 5).toUpperCase();
}

// ── Portfolio weight map ──────────────────────────────────────────────────────

interface WeightEntry { pct: number; name: string; cusip: string }

/**
 * Build a CUSIP-keyed weight map from 13F holdings.
 * CUSIP is a stable identifier that survives company name changes.
 * Falls back to normalized name when CUSIP is blank (rare).
 */
function buildWeightMap(holdings: Holding13F[]): Map<string, WeightEntry> {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  if (totalValue === 0) return new Map();

  const map = new Map<string, WeightEntry>();
  for (const h of holdings) {
    const key = h.cusip || normalizeName(h.nameOfIssuer);
    const pct = (h.value / totalValue) * 100;
    const existing = map.get(key);
    if (!existing || pct > existing.pct) {
      map.set(key, { pct, name: h.nameOfIssuer, cusip: h.cusip });
    }
  }
  return map;
}

// ── Filing XML fetcher ────────────────────────────────────────────────────────

async function fetchFilingHoldings(
  cikNum: number,
  accession: string,
  primaryDoc: string,
): Promise<Holding13F[]> {
  const accNoDashes = accession.replace(/-/g, '');
  const docUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikNum}/${accNoDashes}/${primaryDoc}`;

  let xml: string;
  try {
    const resp = await axios.get(docUrl, {
      headers: SEC_HEADERS, timeout: 20000, responseType: 'text',
    });
    xml = resp.data;
  } catch {
    return [];
  }

  // Primary doc is sometimes a cover page; true holdings are in infotable.xml
  if (!xml.toLowerCase().includes('<infotable>')) {
    try {
      const infoUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikNum}/${accNoDashes}/infotable.xml`;
      const r2 = await axios.get(infoUrl, {
        headers: SEC_HEADERS, timeout: 20000, responseType: 'text',
      });
      xml = r2.data;
    } catch {
      return [];
    }
  }

  return parse13FXML(xml);
}

// ── Main investor fetcher ─────────────────────────────────────────────────────

async function fetchInvestor13F(
  investorSlug: string,
  cik: string,
): Promise<ActivityEvent[]> {
  try {
    // 1. Fetch submission history from EDGAR
    const paddedCik = cik.replace(/^0+/, '').padStart(10, '0');
    const subResp = await axios.get(
      `${EDGAR_BASE}/submissions/CIK${paddedCik}.json`,
      { headers: SEC_HEADERS, timeout: 15000 },
    );
    const recent = subResp.data?.filings?.recent;
    if (!recent?.form) return [];

    const forms: string[]       = recent.form;
    const accessions: string[]  = recent.accessionNumber;
    const filingDates: string[] = recent.filingDate;
    const primaryDocs: string[] = recent.primaryDocument;

    // 2. Find the TWO most recent 13F-HR (or 13F-HR/A amendment) filings
    const is13F = (f: string) => f === '13F-HR' || f === '13F-HR/A';
    const idx1 = forms.findIndex(is13F);
    if (idx1 === -1) {
      console.warn(`[13F Fetcher] No 13F-HR found for ${investorSlug}`);
      return [];
    }
    let idx2 = -1;
    for (let i = idx1 + 1; i < forms.length; i++) {
      if (is13F(forms[i])) { idx2 = i; break; }
    }

    const cikNum = parseInt(cik, 10);

    // 3. Fetch both filings in parallel
    const [currentHoldings, previousHoldings] = await Promise.all([
      fetchFilingHoldings(cikNum, accessions[idx1], primaryDocs[idx1]),
      idx2 >= 0
        ? fetchFilingHoldings(cikNum, accessions[idx2], primaryDocs[idx2])
        : Promise.resolve([] as Holding13F[]),
    ]);

    if (currentHoldings.length === 0) return [];

    // 4. Config holdings used ONLY for ticker resolution (name → symbol mapping)
    const configHoldings =
      EXPERT_INVESTORS[investorSlug as keyof typeof EXPERT_INVESTORS]?.holdings || [];

    // 5. Build CUSIP-keyed weight maps
    const currentMap  = buildWeightMap(currentHoldings);
    const previousMap = buildWeightMap(previousHoldings);

    const filingDate = filingDates[idx1];
    const events: ActivityEvent[] = [];

    // 6. Diff: current vs previous
    for (const [key, { pct, name }] of currentMap) {
      // Resolve ticker: config lookup first, then fallback
      const symbol = resolveTicker(name, configHoldings);
      const prev = previousMap.get(key);

      if (!prev) {
        if (pct >= MIN_NEW_POSITION_PCT) {
          events.push({
            investorSlug,
            eventDate: filingDate,
            symbol,
            assetName: name,
            action: 'new_position',
            amountRange: null,
            sharesChange: null,
            previousPct: null,
            newPct: +pct.toFixed(2),
            source: 'sec_13f',
            rawData: { filingDate, cik, accession: accessions[idx1] },
          });
        }
      } else {
        const diff = pct - prev.pct;
        if (Math.abs(diff) >= MIN_CHANGE_PCT) {
          events.push({
            investorSlug,
            eventDate: filingDate,
            symbol,
            assetName: name,
            action: diff > 0 ? 'increase' : 'decrease',
            amountRange: null,
            sharesChange: null,
            previousPct: +prev.pct.toFixed(2),
            newPct: +pct.toFixed(2),
            source: 'sec_13f',
            rawData: { filingDate, cik, accession: accessions[idx1] },
          });
        }
      }
    }

    // 7. Detect fully closed positions (present in prev, absent in current)
    for (const [key, { pct, name }] of previousMap) {
      if (!currentMap.has(key) && pct >= MIN_CLOSED_POSITION_PCT) {
        const symbol = resolveTicker(name, configHoldings);
        events.push({
          investorSlug,
          eventDate: filingDate,
          symbol,
          assetName: name,
          action: 'closed_position',
          amountRange: null,
          sharesChange: null,
          previousPct: +pct.toFixed(2),
          newPct: null,
          source: 'sec_13f',
          rawData: { filingDate, cik, accession: accessions[idx1] },
        });
      }
    }

    const prevLabel = idx2 >= 0 ? `vs prev (${filingDates[idx2]})` : 'no prev filing';
    console.log(`[13F Fetcher] ${investorSlug}: ${events.length} events — ${filingDate} ${prevLabel}`);
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
